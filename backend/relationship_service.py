"""
Relationship service — AI-initiated, human-approved relationship changes.

The AI cannot change its relationship with the user directly. It files a
request (from→to + reason); the human approves or rejects it from the
Dashboard. On approval, the edge's relationship list is updated. While a
request is pending, the AI keeps behaving per the current relationship.

Multiple non-conflicting relationships can coexist on the same edge
(e.g. "partner,friend").
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select, desc

from db.models import Edge, Path, RelationshipRequest
from relations import (
    Relationship,
    is_valid_relationship,
    is_valid_transition,
    find_conflicts,
    parse_relationships,
    serialize_relationships,
    RELATIONSHIP_LABELS,
    VALID_TRANSITIONS,
)

# The canonical relationship node.
RELATIONSHIP_URI = "core://my_user"


class RelationshipError(Exception):
    """Raised for invalid relationship requests or approvals."""


class RelationshipService:
    def __init__(self, db_manager):
        self.db = db_manager

    async def _resolve_edge(self, session, uri: str, namespace: str) -> Optional[Edge]:
        domain, _, path = uri.partition("://")
        result = await session.execute(
            select(Edge)
            .join(Path, Path.edge_id == Edge.id)
            .where(Path.namespace == namespace, Path.domain == domain, Path.path == path)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_current(self, namespace: str = "", uri: str = RELATIONSHIP_URI) -> dict[str, Any]:
        async with self.db.session() as session:
            edge = await self._resolve_edge(session, uri, namespace)
            if not edge:
                return {"relationships": [], "labels": []}
            rels = parse_relationships(edge.relationship_types)
            return {
                "relationships": rels,
                "labels": [RELATIONSHIP_LABELS.get(r, r) for r in rels],
            }

    async def request_change(
        self,
        from_relationship: str,
        to_relationship: str,
        reason: str,
        emotional_snapshot: Optional[dict] = None,
        namespace: str = "",
        uri: str = RELATIONSHIP_URI,
    ) -> dict[str, Any]:
        if not is_valid_relationship(from_relationship):
            raise RelationshipError(f"Unknown relationship: {from_relationship}")
        if not is_valid_relationship(to_relationship):
            raise RelationshipError(f"Unknown relationship: {to_relationship}")
        if not (reason or "").strip():
            raise RelationshipError("A reason is required for a relationship change")
        if not is_valid_transition(from_relationship, to_relationship):
            valid = ", ".join(sorted(
                VALID_TRANSITIONS.get(from_relationship, set())
            )) or "(none)"
            raise RelationshipError(
                f"Cannot transition {from_relationship} → {to_relationship}. "
                f"Valid targets from {from_relationship}: {valid}"
            )

        async with self.db.session() as session:
            edge = await self._resolve_edge(session, uri, namespace)
            if not edge:
                raise RelationshipError(f"No relationship edge found for '{uri}'")

            current = parse_relationships(edge.relationship_types)
            if from_relationship not in current:
                raise RelationshipError(
                    f"Current relationships {current} do not include '{from_relationship}'"
                )

            # Conflict check: would the target conflict with other held relationships?
            remaining = [r for r in current if r != from_relationship]
            conflicts = find_conflicts(to_relationship, remaining)
            if conflicts:
                raise RelationshipError(
                    f"'{to_relationship}' conflicts with existing: {conflicts}"
                )

            # Reject duplicate pending requests for the same transition.
            dup = await session.execute(
                select(RelationshipRequest).where(
                    RelationshipRequest.edge_id == edge.id,
                    RelationshipRequest.status == "pending",
                    RelationshipRequest.from_relationship == from_relationship,
                    RelationshipRequest.to_relationship == to_relationship,
                )
            )
            if dup.scalar_one_or_none():
                raise RelationshipError("An identical pending request already exists")

            req = RelationshipRequest(
                namespace=namespace,
                edge_id=edge.id,
                from_relationship=from_relationship,
                to_relationship=to_relationship,
                reason=reason.strip(),
                status="pending",
                emotional_snapshot=json.dumps(emotional_snapshot, ensure_ascii=False)
                if emotional_snapshot else None,
            )
            session.add(req)
            await session.flush()
            return self._serialize(req)

    async def approve(self, request_id: int) -> dict[str, Any]:
        async with self.db.session() as session:
            req = await session.get(RelationshipRequest, request_id)
            if not req:
                raise RelationshipError("Request not found")
            if req.status != "pending":
                raise RelationshipError(f"Request already {req.status}")

            edge = await session.get(Edge, req.edge_id)
            if not edge:
                raise RelationshipError("Relationship edge no longer exists")

            current = parse_relationships(edge.relationship_types)
            # Replace from→to. A transition to FRIEND from romantic/spouse is a
            # breakup/divorce: the old bond is removed and friend is added.
            new_rels = [r for r in current if r != req.from_relationship]
            if req.to_relationship not in new_rels:
                new_rels.append(req.to_relationship)
            edge.relationship_types = serialize_relationships(new_rels)

            req.status = "approved"
            req.resolved_at = datetime.now()
            await session.flush()
            return self._serialize(req)

    async def reject(self, request_id: int, response_reason: str = "") -> dict[str, Any]:
        async with self.db.session() as session:
            req = await session.get(RelationshipRequest, request_id)
            if not req:
                raise RelationshipError("Request not found")
            if req.status != "pending":
                raise RelationshipError(f"Request already {req.status}")
            req.status = "rejected"
            req.response_reason = response_reason or None
            req.resolved_at = datetime.now()
            await session.flush()
            return self._serialize(req)

    async def list_requests(
        self, namespace: str = "", status: Optional[str] = None
    ) -> list[dict[str, Any]]:
        async with self.db.session() as session:
            query = select(RelationshipRequest).where(
                RelationshipRequest.namespace == namespace
            )
            if status:
                query = query.where(RelationshipRequest.status == status)
            query = query.order_by(desc(RelationshipRequest.created_at))
            result = await session.execute(query)
            return [self._serialize(r) for r in result.scalars().all()]

    @staticmethod
    def _serialize(req: RelationshipRequest) -> dict[str, Any]:
        snapshot = None
        if req.emotional_snapshot:
            try:
                snapshot = json.loads(req.emotional_snapshot)
            except json.JSONDecodeError:
                snapshot = None
        return {
            "id": req.id,
            "from_relationship": req.from_relationship,
            "to_relationship": req.to_relationship,
            "from_label": RELATIONSHIP_LABELS.get(req.from_relationship, req.from_relationship),
            "to_label": RELATIONSHIP_LABELS.get(req.to_relationship, req.to_relationship),
            "reason": req.reason,
            "status": req.status,
            "response_reason": req.response_reason,
            "emotional_snapshot": snapshot,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "resolved_at": req.resolved_at.isoformat() if req.resolved_at else None,
        }
