# Database Guidelines

> Database patterns and conventions for Nocturne Memory.

---

## Overview

- **ORM**: SQLAlchemy 2.x with async support (`AsyncSession`)
- **Databases**: SQLite (primary, recommended for production) — PostgreSQL support deprecated
- **Session management**: `DatabaseManager` in `backend/db/database.py` — constructor injection pattern
- **Migrations**: Custom runner in `db/migrations/runner.py` (not Alembic)
- **Persistent Storage**: All persistent data stored under `/opt/nocturne-memory/` (data, snapshots, backups, config.json)

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
| `soul_templates` | User-defined soul templates | `(id, namespace)` composite |

### Key Relationships

- `Node` 1:N `Memory` (version chain via `migrated_to`)
- `Node` N:N `Node` via `Edge` (parent→child)
- `Edge` 1:N `Path` (aliases: multiple paths → same edge)
- `GlossaryKeyword` N:1 `Node`

### Edge Model Extensions

`Edge` model includes 6 emotion dimension columns:

| Column | Type | Description |
|--------|------|-------------|
| `emotion_trust` | Integer (0-100) | Trust level |
| `emotion_closeness` | Integer (0-100) | Closeness level |
| `emotion_respect` | Integer (0-100) | Respect level |
| `emotion_dependency` | Integer (0-100) | Dependency level |
| `emotion_security` | Integer (0-100) | Security level |
| `emotion_resonance` | Integer (0-100) | Resonance level |

### SoulTemplate Model

Stores user-defined soul templates:

| Column | Type | Description |
|--------|------|-------------|
| `id` | String(64) | Template identifier |
| `namespace` | String(64) | Namespace (default: "") |
| `name` | Text | Display name |
| `name_en` | Text | English display name |
| `description` | Text | Description |
| `description_en` | Text | English description |
| `persona` | Text (JSON) | Persona variables |
| `memory_nodes` | Text (JSON) | Memory node definitions |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Last update timestamp |

Unique constraint: `(id, namespace)`

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
- New migrations: add a migration file (`NNN_vX.Y.Z_desc.py` with `async def up(engine)`) and it is auto-discovered by filename order
- Add columns idempotently: PostgreSQL `ADD COLUMN IF NOT EXISTS`; SQLite `ADD COLUMN` wrapped in try/except swallowing "duplicate column name"

---

## Column / Attribute Name Mismatch (gotcha)

`serialize_row()` (used for changeset snapshots and rollback) keys its output
dict by **DB column name** but must read values by **mapped attribute name**.
These usually match, but diverge when you map an attribute to a differently
named column — e.g. `Edge.relationship_types = Column("relationship", ...)`
(renamed to avoid shadowing SQLAlchemy's `relationship()` function in the
class body).

- `getattr(obj, column.name)` then raises `AttributeError` because the Python
  attribute is `relationship_types`, not `relationship`.
- `serialize_row()` iterates `inspect(obj).mapper.column_attrs` and uses
  `prop.key` for `getattr` while keying the dict by `prop.columns[0].name`.
- **Rule**: if you ever map an attribute to a column of a different name, the
  snapshot layer already handles it — but any code that does
  `getattr(model, col.name)` will break. Prefer attribute names that match
  column names; rename the column (not the attribute) only when forced by a
  name clash, and document why.

---

## Common Mistakes

1. **Forgetting namespace filter** — Every query must filter by `namespace` unless intentionally cross-namespace. New services that resolve an edge from a URI must join `Path` and filter `Path.namespace == namespace` (see `EmotionService._resolve_edge`, `RelationshipService._resolve_edge`)
2. **Committing manually** — `db.session()` auto-commits; don't call `session.commit()` inside the context manager
3. **Using sync session** — All DB access is async; never use `Session` (sync) from SQLAlchemy
4. **Direct table creation** — Use `Base.metadata.create_all` only in `init_db()`, not in service code
5. **Forgetting `expire_on_commit=False`** — Already set in session factory, but don't override it
6. **Column named like an ORM helper** — A column literally named `relationship` shadows SQLAlchemy's `relationship()` inside the class body; map it to a safe attribute name (see the gotcha above)
