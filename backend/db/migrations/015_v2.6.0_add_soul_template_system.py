import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)


# Emotion dimension columns added to the edges table. Default 50 = neutral.
_EMOTION_COLUMNS = [
    "emotion_trust",
    "emotion_closeness",
    "emotion_respect",
    "emotion_dependency",
    "emotion_security",
    "emotion_resonance",
]


async def up(engine: AsyncEngine):
    """
    Version: v2.6.0
    Soul template system: relationship + emotion + locked protection.

    1. edges.locked         — protect identity memories from AI self-modification
    2. edges.emotion_*      — 6 emotional dimensions toward the relationship target
    3. edges.relationship   — comma-separated relationship types (multi-relationship)
    4. emotion_ledger       — audit log of every emotion delta with reason
    5. relationship_requests — AI-initiated relationship change requests for approval
    """
    is_postgres = "postgresql" in str(engine.url)

    async with engine.begin() as conn:
        # ---- edges.locked -------------------------------------------------
        await _add_column(
            conn, is_postgres, "edges", "locked",
            "BOOLEAN NOT NULL DEFAULT FALSE" if is_postgres
            else "BOOLEAN NOT NULL DEFAULT 0",
        )

        # ---- edges.emotion_* ----------------------------------------------
        for col in _EMOTION_COLUMNS:
            await _add_column(
                conn, is_postgres, "edges", col,
                "INTEGER NOT NULL DEFAULT 50",
            )

        # ---- edges.relationship -------------------------------------------
        # Comma-separated relationship types, e.g. "partner,friend".
        # Empty string = no explicit relationship (default edges).
        await _add_column(
            conn, is_postgres, "edges", "relationship",
            "TEXT NOT NULL DEFAULT ''",
        )

        # ---- emotion_ledger -----------------------------------------------
        if is_postgres:
            await conn.execute(text(
                """
                CREATE TABLE IF NOT EXISTS emotion_ledger (
                    id SERIAL PRIMARY KEY,
                    namespace VARCHAR(64) NOT NULL DEFAULT '',
                    edge_id INTEGER NOT NULL REFERENCES edges(id) ON DELETE CASCADE,
                    delta_trust INTEGER NOT NULL DEFAULT 0,
                    delta_closeness INTEGER NOT NULL DEFAULT 0,
                    delta_respect INTEGER NOT NULL DEFAULT 0,
                    delta_dependency INTEGER NOT NULL DEFAULT 0,
                    delta_security INTEGER NOT NULL DEFAULT 0,
                    delta_resonance INTEGER NOT NULL DEFAULT 0,
                    after_trust INTEGER NOT NULL,
                    after_closeness INTEGER NOT NULL,
                    after_respect INTEGER NOT NULL,
                    after_dependency INTEGER NOT NULL,
                    after_security INTEGER NOT NULL,
                    after_resonance INTEGER NOT NULL,
                    reason TEXT NOT NULL,
                    context TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            ))
        else:
            await conn.execute(text(
                """
                CREATE TABLE IF NOT EXISTS emotion_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    namespace VARCHAR(64) NOT NULL DEFAULT '',
                    edge_id INTEGER NOT NULL REFERENCES edges(id) ON DELETE CASCADE,
                    delta_trust INTEGER NOT NULL DEFAULT 0,
                    delta_closeness INTEGER NOT NULL DEFAULT 0,
                    delta_respect INTEGER NOT NULL DEFAULT 0,
                    delta_dependency INTEGER NOT NULL DEFAULT 0,
                    delta_security INTEGER NOT NULL DEFAULT 0,
                    delta_resonance INTEGER NOT NULL DEFAULT 0,
                    after_trust INTEGER NOT NULL,
                    after_closeness INTEGER NOT NULL,
                    after_respect INTEGER NOT NULL,
                    after_dependency INTEGER NOT NULL,
                    after_security INTEGER NOT NULL,
                    after_resonance INTEGER NOT NULL,
                    reason TEXT NOT NULL,
                    context TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_emotion_ledger_edge "
            "ON emotion_ledger (edge_id, created_at)"
        ))

        # ---- relationship_requests ----------------------------------------
        if is_postgres:
            await conn.execute(text(
                """
                CREATE TABLE IF NOT EXISTS relationship_requests (
                    id SERIAL PRIMARY KEY,
                    namespace VARCHAR(64) NOT NULL DEFAULT '',
                    edge_id INTEGER NOT NULL REFERENCES edges(id) ON DELETE CASCADE,
                    from_relationship TEXT NOT NULL,
                    to_relationship TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    response_reason TEXT,
                    emotional_snapshot TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    resolved_at TIMESTAMP
                )
                """
            ))
        else:
            await conn.execute(text(
                """
                CREATE TABLE IF NOT EXISTS relationship_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    namespace VARCHAR(64) NOT NULL DEFAULT '',
                    edge_id INTEGER NOT NULL REFERENCES edges(id) ON DELETE CASCADE,
                    from_relationship TEXT NOT NULL,
                    to_relationship TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    response_reason TEXT,
                    emotional_snapshot TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    resolved_at TIMESTAMP
                )
                """
            ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_rel_req_ns_status "
            "ON relationship_requests (namespace, status)"
        ))

    logger.info(
        "Migration 015: added locked/emotion/relationship columns to edges, "
        "created emotion_ledger and relationship_requests tables"
    )


async def _add_column(conn, is_postgres: bool, table: str, column: str, ddl: str):
    """Add a column idempotently across SQLite and PostgreSQL."""
    if is_postgres:
        await conn.execute(text(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {ddl}"
        ))
    else:
        try:
            await conn.execute(text(
                f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"
            ))
        except Exception as e:
            if "duplicate column name" not in str(e).lower():
                raise
