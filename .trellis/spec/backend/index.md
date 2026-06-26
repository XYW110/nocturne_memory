# Backend Development Guidelines

> Best practices for backend development in Nocturne Memory.

---

## Overview

The backend is a Python monolith serving REST API (FastAPI), MCP Server (FastMCP), and static SPA hosting. All three share the same database, config, and service layers.

- **Language**: Python 3.10+
- **Framework**: FastAPI + Starlette + SQLAlchemy 2.x async
- **Databases**: SQLite (primary) / PostgreSQL (remote)
- **Config**: `config.json` as sole source of truth

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | Module organization, entry points, naming conventions |
| [Database Guidelines](./database-guidelines.md) | SQLAlchemy async patterns, dual DB support, migrations, ORM models |
| [Error Handling](./error-handling.md) | HTTPException vs ValueError, MCP error strings, i18n errors |
| [Quality Guidelines](./quality-guidelines.md) | Pydantic validation, service singletons, namespace isolation, forbidden patterns |
| [Logging Guidelines](./logging-guidelines.md) | print() to stderr, i18n logs, MCP stdout separation |

---

## Pre-Development Checklist

Before writing backend code:

- [ ] Read [Directory Structure](./directory-structure.md) to understand where your code belongs
- [ ] Read [Database Guidelines](./database-guidelines.md) for query patterns and session management
- [ ] Read [Error Handling](./error-handling.md) for exception conventions
- [ ] Check [Quality Guidelines](./quality-guidelines.md) for required and forbidden patterns
- [ ] Review [Logging Guidelines](./logging-guidelines.md) for output conventions

---

## Quick Reference

### Service Access

```python
from db import get_db_manager, get_graph_service, get_glossary_service, get_search_indexer
```

### Namespace Isolation

```python
from db.namespace import get_namespace
result = await graph.get_memory_by_path(path, namespace=get_namespace())
```

### i18n

```python
from locales import t
raise HTTPException(404, t("api.browse.path_not_found").format(uri=uri))
```

### Config Access

```python
import config as _cfg
value = _cfg.get("key")
```
