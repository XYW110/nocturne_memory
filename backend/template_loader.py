"""
Template loader — the "birth" service.

Reads a soul-template JSON, substitutes persona variables (name, gender, age,
appearance, personality, ...), and writes the resulting memory tree into the
database in a single transaction. Locked identity nodes get edges.locked=True
so the AI cannot later modify them via MCP tools.

A relationship type is chosen at birth; its content (from relationships.json)
becomes the core://my_user node.

Idempotent: paths that already exist are skipped (unless force=True).
"""

from __future__ import annotations

import json
import re
import uuid as uuid_lib
from dataclasses import dataclass, field
from pathlib import Path as FsPath
from typing import Any, Optional

from db.models import ROOT_NODE_UUID
from relations import (
    Relationship,
    is_valid_relationship,
    serialize_relationships,
)

_TEMPLATES_DIR = FsPath(__file__).resolve().parent / "templates"
_VAR_PATTERN = re.compile(r"\{\{(\w+)\}\}")


@dataclass
class ApplyResult:
    created: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    locked: list[str] = field(default_factory=list)
    relationship: Optional[str] = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "created": self.created,
            "skipped": self.skipped,
            "locked": self.locked,
            "relationship": self.relationship,
            "created_count": len(self.created),
            "skipped_count": len(self.skipped),
        }


class TemplateError(Exception):
    """Raised when a template is missing, malformed, or applied with bad input."""


class TemplateLoader:
    def __init__(self, db_manager, graph_service):
        self.db = db_manager
        self.graph = graph_service

    # ------------------------------------------------------------------ #
    # Reading templates
    # ------------------------------------------------------------------ #

    def list_templates(self) -> list[dict[str, Any]]:
        """Return summary metadata for every template in the templates dir."""
        templates = []
        if not _TEMPLATES_DIR.is_dir():
            return templates
        for f in sorted(_TEMPLATES_DIR.glob("*.json")):
            if f.name == "relationships.json":
                continue
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            nodes = data.get("memory_nodes", [])
            domains = sorted({n.get("domain", "core") for n in nodes})
            templates.append({
                "id": data.get("id", f.stem),
                "name": data.get("name", f.stem),
                "name_en": data.get("name_en"),
                "description": data.get("description", ""),
                "node_count": len(nodes),
                "domains": domains,
                "persona_fields": list(data.get("persona", {}).keys()),
            })
        return templates

    def get_template(self, template_id: str) -> dict[str, Any]:
        """Return the full template JSON, or raise TemplateError."""
        path = _TEMPLATES_DIR / f"{template_id}.json"
        if not path.is_file():
            raise TemplateError(f"Template '{template_id}' not found")
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            raise TemplateError(f"Template '{template_id}' is malformed: {e}") from e

    def _load_relationships(self) -> dict[str, Any]:
        path = _TEMPLATES_DIR / "relationships.json"
        if not path.is_file():
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}

    # ------------------------------------------------------------------ #
    # Variable substitution
    # ------------------------------------------------------------------ #

    @staticmethod
    def _resolve_persona(template: dict, persona: dict[str, Any]) -> dict[str, str]:
        """Merge user-supplied persona over template defaults; all values → str."""
        resolved: dict[str, str] = {}
        for field_name, spec in template.get("persona", {}).items():
            if field_name in persona and persona[field_name] not in (None, ""):
                resolved[field_name] = str(persona[field_name])
            elif "default" in spec and spec["default"] is not None:
                resolved[field_name] = str(spec["default"])
            else:
                resolved[field_name] = ""
        return resolved

    @staticmethod
    def _substitute(content: str, values: dict[str, str]) -> str:
        """Replace {{var}} placeholders. Unknown placeholders are left intact."""
        def repl(match: re.Match) -> str:
            key = match.group(1)
            return values.get(key, match.group(0))
        return _VAR_PATTERN.sub(repl, content)

    # ------------------------------------------------------------------ #
    # Applying a template (birth)
    # ------------------------------------------------------------------ #

    async def apply_template(
        self,
        template_id: str,
        persona: dict[str, Any],
        relationship: str,
        namespace: str = "",
        force: bool = False,
        configure_boot: bool = True,
    ) -> ApplyResult:
        template = self.get_template(template_id)

        if not is_valid_relationship(relationship):
            raise TemplateError(f"Unknown relationship type: {relationship}")

        # Required persona fields
        for field_name, spec in template.get("persona", {}).items():
            if spec.get("required") and not (persona.get(field_name) or spec.get("default")):
                raise TemplateError(f"Persona field '{field_name}' is required")

        values = self._resolve_persona(template, persona)
        nodes = template.get("memory_nodes", [])

        # Build the my_user relationship node from relationships.json
        rel_defs = self._load_relationships()
        rel_def = rel_defs.get(relationship)
        my_user_node = None
        if rel_def:
            my_user_node = {
                "domain": "core",
                "path": "my_user",
                "locked": False,
                "content": rel_def.get("content", ""),
                "priority": rel_def.get("priority", 0),
                "disclosure": rel_def.get("disclosure", ""),
                "relationship": relationship,
            }

        all_nodes = list(nodes)
        if my_user_node:
            all_nodes.append(my_user_node)

        # Parents must be created before children — sort by path depth.
        all_nodes.sort(key=lambda n: n.get("path", "").count("/"))

        result = ApplyResult(relationship=relationship)

        async with self.db.session() as session:
            for node in all_nodes:
                await self._apply_node(session, node, values, namespace, result, force=force)

        # Configure boot URIs for the freshly created root nodes (separate
        # transaction; this writes preset/config, not memory data).
        if configure_boot:
            await self._configure_boot_uris(nodes, namespace)

        return result

    async def _apply_node(
        self, session, node: dict, values: dict[str, str], namespace: str, result: ApplyResult,
        force: bool = False,
    ) -> None:
        domain = node.get("domain", "core")
        path = node["path"]
        uri = f"{domain}://{path}"
        content = self._substitute(node.get("content", ""), values)

        # Resolve parent.
        if "/" in path:
            parent_path = path.rsplit("/", 1)[0]
            parent = await self.graph._resolve_path(session, parent_path, domain, namespace=namespace)
            if not parent:
                # Parent wasn't in the template / doesn't exist — skip safely.
                result.skipped.append(uri)
                return
            parent_uuid = parent[2]
        else:
            parent_uuid = ROOT_NODE_UUID

        # Check if the path already exists.
        existing = await self.graph._resolve_path(session, path, domain, namespace=namespace)

        if existing:
            if not force:
                result.skipped.append(uri)
                return

            # Force mode: overwrite the content of the existing node.
            _, _, existing_uuid = existing

            # Get current memory to compare content.
            from sqlalchemy import select as sql_select, update as sql_update
            from db.models import Memory as MemoryModel

            current_mem_result = await session.execute(
                sql_select(MemoryModel)
                .where(
                    MemoryModel.node_uuid == existing_uuid,
                    MemoryModel.deprecated == False,  # noqa: E712
                )
                .order_by(MemoryModel.created_at.desc())
                .limit(1)
            )
            current_mem = current_mem_result.scalar_one_or_none()

            if current_mem and current_mem.content != content:
                new_mem = await self.graph._insert_memory(
                    session, existing_uuid, content, deprecated=True
                )
                await self.graph._deprecate_node_memories(
                    session, existing_uuid, successor_id=new_mem.id
                )
                await session.execute(
                    sql_update(MemoryModel)
                    .where(MemoryModel.id == new_mem.id)
                    .values(deprecated=False, migrated_to=None)
                )
                result.created.append(uri)
            else:
                result.skipped.append(uri)

            # Update edge metadata (locked, relationship).
            from sqlalchemy import select as sql_select_edge
            from db.models import Edge as EdgeModel

            edge_result = await session.execute(
                sql_select_edge(EdgeModel).where(
                    EdgeModel.parent_uuid == parent_uuid,
                    EdgeModel.child_uuid == existing_uuid,
                ).limit(1)
            )
            edge = edge_result.scalar_one_or_none()
            if edge:
                if node.get("locked"):
                    edge.locked = True
                    if uri not in result.locked:
                        result.locked.append(uri)
                if node.get("relationship"):
                    edge.relationship_types = serialize_relationships([node["relationship"]])
            return

        # Create new node (original logic).
        name = path.rsplit("/", 1)[-1]

        new_uuid = str(uuid_lib.uuid4())
        await self.graph._ensure_node(session, new_uuid)
        await self.graph._insert_memory(session, new_uuid, content)

        created = await self.graph._create_edge_with_paths(
            session,
            parent_uuid,
            new_uuid,
            name,
            domain,
            path,
            node.get("priority", 0),
            node.get("disclosure"),
            namespace,
        )
        edge = created["edge"]
        if node.get("locked"):
            edge.locked = True
            result.locked.append(uri)
        if node.get("relationship"):
            edge.relationship_types = serialize_relationships([node["relationship"]])

        await session.flush()
        await self.graph._search.refresh_search_documents_for_node(
            new_uuid, session=session, namespace=namespace
        )
        result.created.append(uri)

    async def _configure_boot_uris(self, nodes: list[dict], namespace: str) -> None:
        """Append all template URIs (including children) to the active preset's boot list."""
        from db import get_preset_service

        all_uris = [
            f"{n.get('domain', 'core')}://{n['path']}"
            for n in nodes
        ]
        # Also include core://my_user (added by apply_template, not in `nodes`).
        my_user_uri = "core://my_user"
        if my_user_uri not in all_uris:
            all_uris.append(my_user_uri)

        if not all_uris:
            return

        service = get_preset_service()
        current = await service.get_boot_uris(namespace)
        merged = list(current)
        for uri in all_uris:
            if uri not in merged:
                merged.append(uri)
        if merged != current:
            await service.set_boot_uris(namespace, merged)
