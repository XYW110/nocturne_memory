import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)


async def up(engine: AsyncEngine):
    """
    Version: v2.6.1
    Add soul_templates table for user-defined soul templates.
    """
    is_postgres = "postgresql" in str(engine.url)

    async with engine.begin() as conn:
        if is_postgres:
            await conn.execute(text(
                """
                CREATE TABLE IF NOT EXISTS soul_templates (
                    id VARCHAR(64) NOT NULL,
                    namespace VARCHAR(64) NOT NULL DEFAULT '',
                    name TEXT NOT NULL,
                    name_en TEXT,
                    description TEXT,
                    description_en TEXT,
                    persona TEXT NOT NULL,
                    memory_nodes TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id, namespace)
                )
                """
            ))
        else:
            await conn.execute(text(
                """
                CREATE TABLE IF NOT EXISTS soul_templates (
                    id VARCHAR(64) NOT NULL,
                    namespace VARCHAR(64) NOT NULL DEFAULT '',
                    name TEXT NOT NULL,
                    name_en TEXT,
                    description TEXT,
                    description_en TEXT,
                    persona TEXT NOT NULL,
                    memory_nodes TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id, namespace)
                )
                """
            ))

    logger.info("Migration 016: added soul_templates table")
