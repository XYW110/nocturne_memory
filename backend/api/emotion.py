"""
Emotion API — read the AI's emotional state and its full change history.

The /adjust endpoint exists so the Dashboard (or tests) can apply deltas the
same way the MCP tool does; in normal operation the AI drives adjustments via
the adjust_emotion MCP tool.
"""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db import get_emotion_service
from db.namespace import get_namespace
from emotion_service import EmotionError, EMOTION_DIMENSIONS

router = APIRouter(prefix="/emotion", tags=["emotion"])

# Default relationship target.
_DEFAULT_URI = "core://my_user"


class AdjustRequest(BaseModel):
    uri: str = _DEFAULT_URI
    adjustments: list[dict[str, Any]]
    context: Optional[str] = None


@router.get("")
async def get_emotion(uri: str = Query(_DEFAULT_URI)):
    """Return the six current emotion values for a relationship target."""
    service = get_emotion_service()
    try:
        values = await service.get_current(uri, namespace=get_namespace())
    except EmotionError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"uri": uri, "dimensions": list(EMOTION_DIMENSIONS), "values": values}


@router.get("/ledger")
async def get_ledger(uri: str = Query(_DEFAULT_URI), limit: int = Query(50, ge=1, le=500)):
    """Return the emotion change history (newest first)."""
    service = get_emotion_service()
    try:
        entries = await service.get_ledger(uri, limit=limit, namespace=get_namespace())
    except EmotionError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"uri": uri, "entries": entries}


@router.post("/adjust")
async def adjust_emotion(body: AdjustRequest):
    """Apply a batch of emotion deltas. Each needs dimension, delta, reason."""
    service = get_emotion_service()
    try:
        values = await service.adjust(
            body.uri, body.adjustments, context=body.context, namespace=get_namespace()
        )
    except EmotionError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"success": True, "uri": body.uri, "values": values}
