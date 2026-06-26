# Database Guidelines

> Database patterns and conventions for Nocturne Memory.

---

## Overview

- **ORM**: SQLAlchemy 2.x with async support (`AsyncSession`)
- **Databases**: SQLite (primary, local) and PostgreSQL (remote, multi-device)
- **Session management**: `DatabaseManager` in `backend/db/database.py` — constructor injection pattern
- **Migrations**: Custom runner in `db/migrations/runner.py` (not Alembic)

---

## DatabaseManager Pattern

All services receive a `DatabaseManager` via constructor injection and use its session context manager:

```python
# ✅ Correct — use the context manager
db = get_db_manager()
async with db.session() as session:
    result = await session.execute(select(Model).where(...))
    # Auto-commits on success, auto-rolls back on exception
```

```python
# ❌ Wrong — don't create sessions manually
session = db.async_session()  # NO
```

### Optional Session Passthrough

Services that can work within an existing transaction or standalone use `_optional_session`:

```python
async def some_operation(self, session=None):
    async with self._optional_session(session) as s:
        # Works with passed session or creates new one
```

---

## Query Patterns

### SQLAlchemy 2.x Style

```python
from sqlalchemy import select, func, distinct

# Select with filter
result = await session.execute(
    select(Path)
    .where(Path.namespace == namespace)
    .where(Path.domain == domain)
)

# Aggregate
result = await session.execute(
    select(Path.domain, func.count(distinct(Path.path)))
    .group_by(Path.domain)
)

# Scalar one-or-none
node = (await session.execute(
    select(Node).where(Node.uuid == node_uuid)
)).scalar_one_or_none()
```

### Raw SQL (Avoid)

Only use raw SQL for SQLite PRAGMAs in `database.py`. All other queries go through the ORM.

---

## SQLite-Specific Settings

Set on every connection via event listener in `database.py`:

```python
PRAGMA foreign_keys=ON
PRAGMA journal_mode=WAL
PRAGMA busy_timeout=5000
PRAGMA synchronous=NORMAL
```

---

## PostgreSQL Connection Pool

Configured via `config.json` keys `db_pool_size` and `db_max_overflow`:

- Default: `pool_size=5`, `max_overflow=5` (single-user MCP workload)
- `pool_size` clamped to `≥ 1` (SQLAlchemy treats 0 as unlimited)
- `pool_recycle=3600`, `pool_pre_ping=True`
- Remote hosts auto-enable `ssl=require`

---

## ORM Models

Defined in `backend/db/models.py`. Core tables:

| Table | Purpose | Primary Key |
|-------|---------|-------------|
| `nodes` | Conceptual entity (UUID-based) | `uuid: String(36)` |
| `memories` | Content versions of a node | `id: Integer` (auto) |
| `edges` | Parent→child relationships | `id: Integer` (auto) |
| `paths` | URI cache (domain://path → edge) | `(namespace, domain, path)` composite |
| `glossary_keywords` | Keyword-to-node bindings | `id: Integer` (auto) |
| `search_documents` | Derived FTS index rows | `(namespace, domain, path)` composite |
| `memory_access_logs` | Async access frequency tracking | `id: Integer` (auto) |
| `presets` | Boot URI preset sets | `id: Integer` (auto) |

### Key Relationships

- `Node` 1:N `Memory` (version chain via `migrated_to`)
- `Node` N:N `Node` via `Edge` (parent→child)
- `Edge` 1:N `Path` (aliases: multiple paths → same edge)
- `GlossaryKeyword` N:1 `Node`

---

## Serialization for Snapshots

Use `serialize_row()` from `models.py` to convert ORM instances to dicts for changeset recording:

```python
from db.models import serialize_row, serialize_memory_ref

# Full row (for nodes, edges, paths)
data = serialize_row(node_instance)

# Memory without content (pointer only — content stays in DB)
data = serialize_memory_ref(memory_instance)
```

---

## Migrations

- Runner: `db/migrations/runner.py`
- Called by `DatabaseManager.init_db()` after table creation
- Idempotent — safe to run on every startup
- New migrations: add a migration file and register it in the runner

---

## Common Mistakes

1. **Forgetting namespace filter** — Every query must filter by `namespace` unless intentionally cross-namespace
2. **Committing manually** — `db.session()` auto-commits; don't call `session.commit()` inside the context manager
3. **Using sync session** — All DB access is async; never use `Session` (sync) from SQLAlchemy
4. **Direct table creation** — Use `Base.metadata.create_all` only in `init_db()`, not in service code
5. **Forgetting `expire_on_commit=False`** — Already set in session factory, but don't override it
