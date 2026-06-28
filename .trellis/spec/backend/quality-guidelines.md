# Quality Guidelines

> Code quality standards for Nocturne Memory backend.

---

## Overview

- **Language**: Python 3.10+ (uses `X | Y` union syntax, `dict[str, Any]` generics)
- **Type checking**: Pyright (selective suppression via `# pyright:` comments)
- **Linting**: No formal linter enforced; rely on Pyright + code review
- **Testing**: pytest (see `pytest.ini`)

---

## Pyright Directives

The codebase uses targeted Pyright suppressions at file level:

```python
# pyright: reportMissingImports=false        — for config.py relative imports
# pyright: reportArgumentType=false          — for SQLAlchemy dynamic types
# pyright: reportAttributeAccessIssue=false  — for ORM relationship access
```

**Rule**: Only suppress specific diagnostics, never blanket `type: ignore`.

---

## Required Patterns

### 1. Pydantic Models for Request Validation

All API request bodies must use Pydantic `BaseModel`:

```python
class CreateMemoryRequest(BaseModel):
    parent_path: str
    content: str
    priority: int = Field(ge=0)        # Non-negative constraint
    disclosure: str
    title: str | None = None
    domain: str = "core"
```

**Rules:**
- Use `Field(ge=0)` for priority values (must be non-negative)
- Inline request models in router files (not in `models/schemas.py`)
- Shared response models go in `models/schemas.py`

### 2. Service Singleton Access

Access services through `db/__init__.py` getters:

```python
from db import get_db_manager, get_graph_service, get_glossary_service

graph = get_graph_service()
db = get_db_manager()
```

Never instantiate services directly in API code.

### 3. Namespace Isolation

Every database query must filter by namespace:

```python
from db.namespace import get_namespace

results = await graph.get_children(node_uuid, namespace=get_namespace())
```

### 4. i18n for User-Facing Messages

```python
from locales import t

# ✅ Correct
raise HTTPException(404, t("api.browse.path_not_found").format(uri=uri))

# ❌ Wrong — hardcoded English
raise HTTPException(404, f"Path {uri} not found")
```

### 5. Config Access via `config.get()`

```python
import config as _cfg

# ✅ Correct
domains = _cfg.get("valid_domains")

# ❌ Wrong — direct JSON loading
with open("config.json") as f: ...
```

---

## Forbidden Patterns

### 1. Direct Session Creation

```python
# ❌ WRONG — bypasses DatabaseManager lifecycle
session = async_session()

# ✅ CORRECT
async with db.session() as session:
    ...
```

### 2. Sync Database Access

```python
# ❌ WRONG — all DB access must be async
session = Session(engine)

# ✅ CORRECT
async with db.session() as session:
    ...
```

### 3. Hardcoded Config Values

```python
# ❌ WRONG
DOMAINS = ["core", "writer", "game"]

# ✅ CORRECT — read from config
domains = config.get("valid_domains")
```

### 4. Ignoring Namespace

```python
# ❌ WRONG — cross-namespace data leak
result = await session.execute(select(Path))

# ✅ CORRECT
result = await session.execute(
    select(Path).where(Path.namespace == get_namespace())
)
```

### 5. Writing to .env

```python
# ❌ WRONG — .env is read-only migration source
with open(".env", "w") as f: ...

# ✅ CORRECT — write to config.json
config.set_value("key", value)
```

---

## Common Mistakes

### 1. Emotion Initialization Condition Reversed

**Symptom**: `init-existing` endpoint fails to initialize emotion dimensions because values are already set to the database default (50).

**Cause**: Checking for `current == 50` instead of `current == 0`. When an Edge record is created, emotion dimensions default to 50 in the database schema. The condition `current == 50` would overwrite these default values, but skip values that are actually 0 (meaning "not initialized").

**Fix**: Use `current is None or current == 0` to match the "补齐缺失" (fill in missing) semantic.

```python
# ❌ WRONG — overwrites default 50 values
if current is None or current == 50:
    setattr(edge, f"emotion_{dim}", target_value)

# ✅ CORRECT — only initializes None or 0 values
if current is None or current == 0:
    setattr(edge, f"emotion_{dim}", target_value)
```

**Prevention**: Remember the difference between:
- `init-existing`: Only initialize **missing** values (None or 0)
- `reset-existing`: Force update **all** values to template defaults

---

## Testing Requirements

- **Framework**: pytest (configured in `pytest.ini`)
- **Test location**: `backend/tests/`
- **Fixtures**: `conftest.py` with test database setup
- **Run command**: `pytest` from project root

---

## Code Review Checklist

- [ ] All queries filter by namespace
- [ ] Request bodies use Pydantic models with `Field(ge=0)` for priority
- [ ] Error messages use `t()` for i18n
- [ ] Services accessed via singleton getters
- [ ] No direct `config.json` file I/O outside `config.py`
- [ ] No sync SQLAlchemy usage
- [ ] Pyright suppressions are specific (not blanket)
