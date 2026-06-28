"""
Soul Templates Service — manages user-defined soul templates stored in the database.

Built-in templates live in backend/templates/*.json and are read-only.
User-created templates are stored in the soul_templates table and can be edited/deleted.

The TemplateLoader merges both sources when listing/applying templates.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from sqlalchemy import select

from db.models import SoulTemplate


class SoulTemplateService:
    def __init__(self, db_manager):
        self.db = db_manager

    async def list_templates(self, namespace: str = "") -> list[dict[str, Any]]:
        """List all user-defined templates for a namespace."""
        async with self.db.session() as session:
            result = await session.execute(
                select(SoulTemplate).where(SoulTemplate.namespace == namespace)
            )
            return [self._serialize(t) for t in result.scalars().all()]

    async def get_template(self, template_id: str, namespace: str = "") -> Optional[dict[str, Any]]:
        """Get a user-defined template by ID."""
        async with self.db.session() as session:
            result = await session.execute(
                select(SoulTemplate).where(
                    SoulTemplate.id == template_id,
                    SoulTemplate.namespace == namespace,
                )
            )
            template = result.scalar_one_or_none()
            return self._serialize(template) if template else None

    async def create_template(
        self,
        template_id: str,
        name: str,
        persona: dict[str, Any],
        memory_nodes: list[dict[str, Any]],
        namespace: str = "",
        name_en: Optional[str] = None,
        description: Optional[str] = None,
        description_en: Optional[str] = None,
    ) -> dict[str, Any]:
        """Create a new user-defined template."""
        async with self.db.session() as session:
            existing = await session.execute(
                select(SoulTemplate).where(
                    SoulTemplate.id == template_id,
                    SoulTemplate.namespace == namespace,
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError(f"Template '{template_id}' already exists")

            template = SoulTemplate(
                id=template_id,
                namespace=namespace,
                name=name,
                name_en=name_en,
                description=description,
                description_en=description_en,
                persona=json.dumps(persona, ensure_ascii=False),
                memory_nodes=json.dumps(memory_nodes, ensure_ascii=False),
            )
            session.add(template)
            await session.flush()
            return self._serialize(template)

    async def update_template(
        self,
        template_id: str,
        namespace: str = "",
        **kwargs,
    ) -> Optional[dict[str, Any]]:
        """Update an existing user-defined template."""
        async with self.db.session() as session:
            result = await session.execute(
                select(SoulTemplate).where(
                    SoulTemplate.id == template_id,
                    SoulTemplate.namespace == namespace,
                )
            )
            template = result.scalar_one_or_none()
            if not template:
                return None

            if "name" in kwargs:
                template.name = kwargs["name"]
            if "name_en" in kwargs:
                template.name_en = kwargs["name_en"]
            if "description" in kwargs:
                template.description = kwargs["description"]
            if "description_en" in kwargs:
                template.description_en = kwargs["description_en"]
            if "persona" in kwargs:
                template.persona = json.dumps(kwargs["persona"], ensure_ascii=False)
            if "memory_nodes" in kwargs:
                template.memory_nodes = json.dumps(kwargs["memory_nodes"], ensure_ascii=False)

            await session.flush()
            return self._serialize(template)

    async def delete_template(self, template_id: str, namespace: str = "") -> bool:
        """Delete a user-defined template."""
        async with self.db.session() as session:
            result = await session.execute(
                select(SoulTemplate).where(
                    SoulTemplate.id == template_id,
                    SoulTemplate.namespace == namespace,
                )
            )
            template = result.scalar_one_or_none()
            if not template:
                return False

            await session.delete(template)
            await session.flush()
            return True

    @staticmethod
    def _serialize(template: SoulTemplate) -> dict[str, Any]:
        """Convert a SoulTemplate ORM object to a plain dict."""
        try:
            persona = json.loads(template.persona)
        except json.JSONDecodeError:
            persona = {}
        try:
            memory_nodes = json.loads(template.memory_nodes)
        except json.JSONDecodeError:
            memory_nodes = []

        return {
            "id": template.id,
            "name": template.name,
            "name_en": template.name_en,
            "description": template.description,
            "description_en": template.description_en,
            "persona": persona,
            "memory_nodes": memory_nodes,
            "node_count": len(memory_nodes),
            "domains": sorted({n.get("domain", "core") for n in memory_nodes}),
            "persona_fields": list(persona.keys()),
            "created_at": template.created_at.isoformat() if template.created_at else None,
            "updated_at": template.updated_at.isoformat() if template.updated_at else None,
            "is_custom": True,
        }