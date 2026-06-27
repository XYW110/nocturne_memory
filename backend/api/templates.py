"""
Templates API — list soul templates and "give birth" to an AI.

Applying a template creates the AI's initial identity memories with the
caller-supplied persona (name, gender, age, appearance, ...) and an initial
relationship type. See backend/template_loader.py.
"""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import get_template_loader
from db.namespace import get_namespace
from template_loader import TemplateError

router = APIRouter(prefix="/templates", tags=["templates"])


class ApplyRequest(BaseModel):
    persona: dict[str, Any]
    relationship: str
    namespace: Optional[str] = None


@router.get("")
async def list_templates():
    """List available soul templates (summary metadata only)."""
    loader = get_template_loader()
    return {"templates": loader.list_templates()}


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
