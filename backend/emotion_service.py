"""
Emotion service — tracks the AI's feelings toward a relationship target.

Six dimensions (trust, closeness, respect, dependency, security, resonance)
live on the edge of the target node (e.g. core://my_user). The AI never sets
absolute values; it submits small deltas with a required reason, and every
change is appended to the emotion_ledger for the Dashboard to audit.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select, desc

from db.models import Edge, EmotionLedger, Path

# The six tracked dimensions, in display order.
EMOTION_DIMENSIONS = (
    "trust",
    "closeness",
    "respect",
    "dependency",
    "security",
    "resonance",
)

MIN_VALUE = 0
MAX_VALUE = 100
MAX_DELTA = 5
MIN_DELTA = -5


class EmotionError(Exception):
    """Raised for invalid emotion adjustments (bad dimension, range, target)."""


def _clamp(value: int) -> int:
    return max(MIN_VALUE, min(MAX_VALUE, value))


class EmotionService:
    def __init__(self, db_manager):
        self.db = db_manager

    async def _resolve_edge(self, session, uri: str, namespace: str) -> Optional[Edge]:
        """Resolve a URI like 'core://my_user' to its Edge."""
        domain, _, path = uri.partition("://")
        if not path and "://" not in uri:
            # bare path fallback
            domain, path = "core", uri
        result = await session.execute(
            select(Edge)
            .join(Path, Path.edge_id == Edge.id)
            .where(Path.namespace == namespace, Path.domain == domain, Path.path == path)
            .limit(1)
        )
        return result.scalar_one_or_none()

    def _current_values(self, edge: Edge) -> dict[str, int]:
        return {dim: getattr(edge, f"emotion_{dim}") for dim in EMOTION_DIMENSIONS}

    async def get_current(self, uri: str, namespace: str = "") -> dict[str, int]:
        async with self.db.session() as session:
            edge = await self._resolve_edge(session, uri, namespace)
            if not edge:
                raise EmotionError(f"No relationship edge found for '{uri}'")
            return self._current_values(edge)

    async def adjust(
        self,
        uri: str,
        adjustments: list[dict[str, Any]],
        context: Optional[str] = None,
        namespace: str = "",
    ) -> dict[str, int]:
        """Apply a batch of {dimension, delta, reason} adjustments atomically.

        Returns the resulting values for all six dimensions.
        """
        if not adjustments:
            raise EmotionError("No adjustments provided")

        # Validate up front so a bad item rejects the whole batch.
        deltas: dict[str, int] = {dim: 0 for dim in EMOTION_DIMENSIONS}
        reasons: list[str] = []
        for adj in adjustments:
            dim = adj.get("dimension")
            if dim not in EMOTION_DIMENSIONS:
                raise EmotionError(
                    f"Unknown dimension '{dim}'. Valid: {', '.join(EMOTION_DIMENSIONS)}"
                )
            delta = adj.get("delta")
            if not isinstance(delta, int):
                raise EmotionError(f"Delta for '{dim}' must be an integer")
            if delta < MIN_DELTA or delta > MAX_DELTA:
                raise EmotionError(
                    f"Delta for '{dim}' out of range ({MIN_DELTA}..{MAX_DELTA}): {delta}"
                )
            reason = (adj.get("reason") or "").strip()
            if not reason:
                raise EmotionError(f"A reason is required for adjusting '{dim}'")
            deltas[dim] += delta
            reasons.append(f"{dim}{'+' if delta >= 0 else ''}{delta}: {reason}")

        async with self.db.session() as session:
            edge = await self._resolve_edge(session, uri, namespace)
            if not edge:
                raise EmotionError(f"No relationship edge found for '{uri}'")

            after: dict[str, int] = {}
            for dim in EMOTION_DIMENSIONS:
                col = f"emotion_{dim}"
                new_val = _clamp(getattr(edge, col) + deltas[dim])
                setattr(edge, col, new_val)
                after[dim] = new_val

            ledger = EmotionLedger(
                namespace=namespace,
                edge_id=edge.id,
                reason="; ".join(reasons),
                context=context,
                **{f"delta_{d}": deltas[d] for d in EMOTION_DIMENSIONS},
                **{f"after_{d}": after[d] for d in EMOTION_DIMENSIONS},
            )
            session.add(ledger)
            await session.flush()

            return after

    async def get_ledger(
        self, uri: str, limit: int = 50, namespace: str = ""
    ) -> list[dict[str, Any]]:
        """Return the emotion change history for a target, newest first."""
        async with self.db.session() as session:
            edge = await self._resolve_edge(session, uri, namespace)
            if not edge:
                raise EmotionError(f"No relationship edge found for '{uri}'")

            result = await session.execute(
                select(EmotionLedger)
                .where(EmotionLedger.edge_id == edge.id)
                .order_by(desc(EmotionLedger.created_at))
                .limit(limit)
            )
            rows = result.scalars().all()
            return [self._serialize_ledger(r) for r in rows]

    @staticmethod
    def _serialize_ledger(row: EmotionLedger) -> dict[str, Any]:
        return {
            "id": row.id,
            "deltas": {d: getattr(row, f"delta_{d}") for d in EMOTION_DIMENSIONS},
            "after": {d: getattr(row, f"after_{d}") for d in EMOTION_DIMENSIONS},
            "reason": row.reason,
            "context": row.context,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
