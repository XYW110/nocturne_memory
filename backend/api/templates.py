"""
Templates API — list soul templates and "give birth" to an AI.

Applying a template creates the AI's initial identity memories with the
caller-supplied persona (name, gender, age, appearance, ...) and an initial
relationship type. See backend/template_loader.py.
"""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import get_template_loader, get_graph_service
from db.namespace import get_namespace
from emotion_service import EMOTION_DIMENSIONS
from template_loader import TemplateError

router = APIRouter(prefix="/templates", tags=["templates"])


class ApplyRequest(BaseModel):
    persona: dict[str, Any]
    relationship: str
    namespace: Optional[str] = None


class InitExistingRequest(BaseModel):
    relationship: str = "partner"
    namespace: Optional[str] = None


class ResetExistingRequest(BaseModel):
    relationship: str = "partner"
    namespace: Optional[str] = None


@router.get("")
async def list_templates():
    """List available soul templates (summary metadata only)."""
    loader = get_template_loader()
    return {"templates": loader.list_templates()}


# ── Specific routes must come BEFORE /{template_id} (generic) ──

@router.post("/init-existing")
async def init_existing(body: InitExistingRequest):
    """One-click initialize the soul template for an existing memory graph.

    Applies the default soul template with default persona (creating the 5
    memory nodes — agent, operating_principles, philosophy, showroom_quality,
    preferences — skipping any that already exist). Updates core://my_user's
    relationship content and type. Initializes all six emotion dimensions to 50.

    This is the recovery path for users who had memory data before the soul
    template system was introduced, or who want to switch relationship type
    and re-seed the relationship content in one step.
    """
    from relations import is_valid_relationship, serialize_relationships
    from relationship_service import RELATIONSHIP_URI

    if not is_valid_relationship(body.relationship):
        raise HTTPException(status_code=422, detail=f"Unknown relationship type: {body.relationship}")

    namespace = body.namespace if body.namespace is not None else get_namespace()
    loader = get_template_loader()
    graph = get_graph_service()

    # 1. Apply the default soul template with default persona — creates the
    #    5 identity nodes (skips existing ones) and core://my_user if absent.
    template = loader.get_template("default")
    default_persona: dict[str, Any] = {}
    for field_name, spec in template.get("persona", {}).items():
        if "default" in spec and spec["default"] is not None:
            default_persona[field_name] = spec["default"]

    apply_result = await loader.apply_template(
        "default",
        persona=default_persona,
        relationship=body.relationship,
        namespace=namespace,
        configure_boot=False,
    )

    # 2. Update core://my_user's relationship content & type (apply_template
    #    skips it when the path already exists, so we patch it here).
    rel_defs = loader._load_relationships()
    rel_def = rel_defs.get(body.relationship, {})
    rel_content = rel_def.get("content", "")

    from sqlalchemy import select
    from db.models import Path, Edge, Memory

    emotion_updated: list[str] = []
    relationship_updated = False
    content_updated = False

    async with graph.session() as session:
        result = await session.execute(
            select(Path, Edge, Memory)
            .join(Edge, Path.edge_id == Edge.id)
            .join(
                Memory,
                (Memory.node_uuid == Edge.child_uuid)
                & (Memory.deprecated == False),  # noqa: E712
            )
            .where(
                Path.namespace == namespace,
                Path.domain == "core",
                Path.path == "my_user",
            )
            .order_by(Memory.created_at.desc())
            .limit(1)
        )
        row = result.first()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="core://my_user not found after applying template.",
            )

        path_obj, edge, memory = row

        # Switch relationship type.
        current_rels = [r.strip() for r in (edge.relationship_types or "").split(",") if r.strip()]
        if body.relationship not in current_rels:
            edge.relationship_types = serialize_relationships([body.relationship])
            relationship_updated = True

        # Refresh relationship content (switch relationship → new content).
        if rel_content and memory.content != rel_content:
            from sqlalchemy import update as sql_update
            new_mem = await graph._insert_memory(
                session, edge.child_uuid, rel_content, deprecated=True
            )
            await graph._deprecate_node_memories(
                session,
                edge.child_uuid,
                successor_id=new_mem.id,
            )
            await session.execute(
                sql_update(Memory)
                .where(Memory.id == new_mem.id)
                .values(deprecated=False, migrated_to=None)
            )
            content_updated = True

        # Initialize emotions to 50 when missing or zero.
        for dim in EMOTION_DIMENSIONS:
            current = getattr(edge, f"emotion_{dim}")
            if current is None or current == 0:
                setattr(edge, f"emotion_{dim}", 50)
                emotion_updated.append(dim)

        await session.flush()

    return {
        "success": True,
        "uri": RELATIONSHIP_URI,
        "created": apply_result.created,
        "skipped": apply_result.skipped,
        "locked": apply_result.locked,
        "emotion_updated": emotion_updated,
        "relationship_updated": relationship_updated,
        "content_updated": content_updated,
        "relationship": body.relationship,
    }


@router.post("/reset-existing")
async def reset_existing(body: ResetExistingRequest):
    """Force-reset the soul template — overwrite ALL existing memory nodes.

    Unlike init-existing (which skips nodes that already exist), this endpoint
    re-applies the default template with force=True, replacing the content of
    every identity node with the template defaults. Also updates the
    relationship content in core://my_user and initializes emotions to 50.

    Use this when you want to fully reset the AI's identity back to the
    template defaults after manual edits.
    """
    from relations import is_valid_relationship, serialize_relationships
    from relationship_service import RELATIONSHIP_URI

    if not is_valid_relationship(body.relationship):
        raise HTTPException(status_code=422, detail=f"Unknown relationship type: {body.relationship}")

    namespace = body.namespace if body.namespace is not None else get_namespace()
    loader = get_template_loader()
    graph = get_graph_service()

    # 1. Build default persona from template defaults.
    template = loader.get_template("default")
    default_persona: dict[str, Any] = {}
    for field_name, spec in template.get("persona", {}).items():
        if "default" in spec and spec["default"] is not None:
            default_persona[field_name] = spec["default"]

    # 2. Apply template with force=True — overwrites existing nodes.
    apply_result = await loader.apply_template(
        "default",
        persona=default_persona,
        relationship=body.relationship,
        namespace=namespace,
        force=True,
        configure_boot=False,
    )

    # 3. Update core://my_user's relationship content & type.
    rel_defs = loader._load_relationships()
    rel_def = rel_defs.get(body.relationship, {})
    rel_content = rel_def.get("content", "")

    from sqlalchemy import select, delete as sql_delete
    from db.models import Path, Edge, Memory, Node

    emotion_updated: list[str] = []
    relationship_updated = False
    content_updated = False
    deleted_extra: list[str] = []

    # Template-defined child paths under core://agent.
    template_agent_children = {
        n["path"].split("/", 1)[1]
        for n in template.get("memory_nodes", [])
        if n.get("path", "").startswith("agent/")
    }

    async with graph.session() as session:
        # ── Clean extra children under core://agent ──
        # Find core://agent's node_uuid.
        agent_result = await session.execute(
            select(Path.node_uuid)
            .where(
                Path.namespace == namespace,
                Path.domain == "core",
                Path.path == "agent",
            )
            .limit(1)
        )
        agent_uuid = agent_result.scalar_one_or_none()

        if agent_uuid:
            # Find all child edges of core://agent.
            child_edges = await session.execute(
                select(Edge, Path)
                .join(Path, Path.edge_id == Edge.id)
                .where(
                    Edge.parent_uuid == agent_uuid,
                    Path.namespace == namespace,
                    Path.domain == "core",
                )
            )
            edges_to_delete = []
            for edge, path_obj in child_edges.all():
                # Keep only direct children (path = "agent/xxx", no deeper /).
                child_path = path_obj.path
                if not child_path.startswith("agent/"):
                    continue
                child_name = child_path.split("/", 1)[1]
                if "/" in child_name:
                    continue  # deeper than direct child, skip
                if child_name not in template_agent_children:
                    edges_to_delete.append((edge, path_obj))

            # Cascade-delete the extra nodes.
            for edge, path_obj in edges_to_delete:
                deleted_extra.append(f"core://{path_obj.path}")
                await graph.cascade_delete_node(session, edge.child_uuid)

        await session.flush()

        # ── Update core://my_user ──
        result = await session.execute(
            select(Path, Edge, Memory)
            .join(Edge, Path.edge_id == Edge.id)
            .join(
                Memory,
                (Memory.node_uuid == Edge.child_uuid)
                & (Memory.deprecated == False),  # noqa: E712
            )
            .where(
                Path.namespace == namespace,
                Path.domain == "core",
                Path.path == "my_user",
            )
            .order_by(Memory.created_at.desc())
            .limit(1)
        )
        row = result.first()

        if row:
            path_obj, edge, memory = row

            # Switch relationship type.
            current_rels = [r.strip() for r in (edge.relationship_types or "").split(",") if r.strip()]
            if body.relationship not in current_rels:
                edge.relationship_types = serialize_relationships([body.relationship])
                relationship_updated = True

            # Refresh relationship content.
            if rel_content and memory.content != rel_content:
                from sqlalchemy import update as sql_update
                new_mem = await graph._insert_memory(
                    session, edge.child_uuid, rel_content, deprecated=True
                )
                await graph._deprecate_node_memories(
                    session,
                    edge.child_uuid,
                    successor_id=new_mem.id,
                )
                await session.execute(
                    sql_update(Memory)
                    .where(Memory.id == new_mem.id)
                    .values(deprecated=False, migrated_to=None)
                )
                content_updated = True

            # Initialize emotions to 50 when missing or zero.
            for dim in EMOTION_DIMENSIONS:
                current = getattr(edge, f"emotion_{dim}")
                if current is None or current == 0:
                    setattr(edge, f"emotion_{dim}", 50)
                    emotion_updated.append(dim)

            await session.flush()

    return {
        "success": True,
        "uri": RELATIONSHIP_URI,
        "created": apply_result.created,
        "skipped": apply_result.skipped,
        "locked": apply_result.locked,
        "emotion_updated": emotion_updated,
        "relationship_updated": relationship_updated,
        "content_updated": content_updated,
        "deleted_extra": deleted_extra,
        "relationship": body.relationship,
    }


# ── Generic routes (/{template_id}) must come AFTER specific routes ──

@router.get("/{template_id}")
async def get_template(template_id: str):
    """Return a template's full definition (persona fields + node previews)."""
    loader = get_template_loader()
    try:
        return loader.get_template(template_id)
    except TemplateError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{template_id}/apply")
async def apply_template(template_id: str, body: ApplyRequest):
    """Apply a template — give birth to the AI's initial soul."""
    loader = get_template_loader()
    namespace = body.namespace if body.namespace is not None else get_namespace()
    try:
        result = await loader.apply_template(
            template_id,
            persona=body.persona,
            relationship=body.relationship,
            namespace=namespace,
        )
    except TemplateError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"success": True, **result.as_dict()}
