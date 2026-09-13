"""
Relationship API — view the current relationship, list AI-initiated change
requests, and approve/reject them from the Dashboard.
"""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db import get_relationship_service
from db.namespace import get_namespace
from relationship_service import RelationshipError, RELATIONSHIP_URI

router = APIRouter(prefix="/relationship", tags=["relationship"])


class RequestChange(BaseModel):
    from_relationship: str
    to_relationship: str
    reason: str
    emotional_snapshot: Optional[dict] = None
    uri: str = RELATIONSHIP_URI


class RejectBody(BaseModel):
    reason: str = ""


@router.get("/current")
async def current_relationship(uri: str = Query(RELATIONSHIP_URI)):
    """Return the relationship types currently held toward the user."""
    service = get_relationship_service()
    return await service.get_current(namespace=get_namespace(), uri=uri)


@router.get("/requests")
async def list_requests(status: Optional[str] = Query(None)):
    """List relationship change requests, optionally filtered by status."""
    service = get_relationship_service()
    requests = await service.list_requests(namespace=get_namespace(), status=status)
    return {"requests": requests}


@router.post("/request")
async def request_change(body: RequestChange):
    """File a relationship change request (normally called by the AI)."""
    service = get_relationship_service()
    try:
        result = await service.request_change(
            from_relationship=body.from_relationship,
            to_relationship=body.to_relationship,
            reason=body.reason,
            emotional_snapshot=body.emotional_snapshot,
            namespace=get_namespace(),
            uri=body.uri,
        )
    except RelationshipError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"success": True, "request": result}


@router.post("/requests/{request_id}/approve")
async def approve_request(request_id: int):
    """Approve a pending relationship change."""
    service = get_relationship_service()
    try:
        result = await service.approve(request_id)
    except RelationshipError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"success": True, "request": result}


@router.post("/requests/{request_id}/reject")
async def reject_request(request_id: int, body: RejectBody):
    """Reject a pending relationship change with an optional reason."""
    service = get_relationship_service()
    try:
        result = await service.reject(request_id, response_reason=body.reason)
    except RelationshipError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"success": True, "request": result}
