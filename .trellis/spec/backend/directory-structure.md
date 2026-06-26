# Directory Structure

> How backend code is organized in Nocturne Memory.

---

## Overview

The backend is a Python monolith under `backend/`. It serves three roles simultaneously:
1. **REST API** (FastAPI) — Admin Dashboard endpoints
2. **MCP Server** (FastMCP) — AI agent tool interface via stdio/SSE
3. **Static SPA Host** — Serves the built frontend `dist/` as a fallback

All three share the same database, config, and service layers.

---

## Directory Layout

```
backend/
├── main.py                    # Web entrypoint (uvicorn launcher)
├── run_sse.py                 # SSE transport entrypoint for MCP
├── mcp_server.py              # MCP tool definitions (FastMCP)
├── mcp_wrapper.py             # MCP transport wrappers
├── web_app.py                 # ASGI app builder (unifies API + SPA)
├── config.py                  # config.json loader (sole config source)
├── auth.py                    # Bearer Token middleware + CORS
├── health.py                  # /health endpoint
├── system_views.py            # system:// URI virtual views
├── text_patch.py              # Normalized text diff/patch utilities
├── namespace_middleware.py    # X-Namespace header extraction
│
├── api/                       # REST API routers (FastAPI)
│   ├── __init__.py            # Exports all routers
│   ├── browse.py              # /api/browse/* — memory CRUD
│   ├── review.py              # /api/review/* — changeset review/rollback
│   ├── maintenance.py         # /api/maintenance/* — cleanup ops
│   ├── settings.py            # /api/settings/* — config management
│   ├── presets.py             # /api/presets/* — boot URI presets
│   └── utils.py               # Shared API helpers (text diff)
│
├── db/                        # Database layer
│   ├── __init__.py            # Singleton getters (get_db_manager, etc.)
│   ├── database.py            # DatabaseManager (engine, sessions)
│   ├── models.py              # ORM models (Node, Memory, Edge, Path, etc.)
│   ├── graph.py               # GraphService — core graph operations
│   ├── glossary.py            # GlossaryService — keyword bindings
│   ├── search.py              # SearchIndexer — FTS index management
│   ├── search_terms.py        # CJK-aware search term extraction
│   ├── snapshot.py            # ChangesetStore — before/after tracking
│   ├── namespace.py           # Namespace resolution middleware helper
│   ├── presets.py             # PresetService — boot URI presets CRUD
│   ├── neo4j_client.py        # Legacy Neo4j client (migration only)
│   └── migrations/            # Schema migration runner
│       └── runner.py
│
├── models/                    # Shared Pydantic schemas
│   ├── __init__.py
│   └── schemas.py             # Request/response models for API
│
├── locales/                   # i18n
│   ├── __init__.py            # t() translation function
│   ├── middleware.py           # Locale middleware (Accept-Language)
│   ├── en.json                # English translations
│   └── zh.json                # Chinese translations
│
├── scripts/                   # Utility scripts
│   └── migrate_neo4j_to_sqlite.py
│
└── tests/                     # Test suite
    └── conftest.py            # Pytest fixtures
```

---

## Module Organization Rules

### API Routers (`api/`)
- One router per resource domain (browse, review, settings, presets, maintenance)
- Each router defines its own Pydantic request models inline (not in `models/schemas.py`)
- Shared response models live in `models/schemas.py`
- Routers are registered in `web_app.py` via `api.include_router()`

### Database Layer (`db/`)
- **Services are singletons** — accessed via `get_db_manager()`, `get_graph_service()`, etc. from `db/__init__.py`
- `database.py` is infrastructure-only: engine, session factory, migrations
- `graph.py` contains all node/memory/edge/path business logic
- `models.py` defines ORM models and shared utilities (`serialize_row`, `escape_like_literal`)

### Entry Points
- `main.py` — Web-only mode (REST API + SPA)
- `run_sse.py` — MCP SSE transport (also hosts admin UI)
- `mcp_server.py` — MCP stdio transport (auto-launches embedded admin UI)

---

## Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Files | snake_case | `graph.py`, `search_terms.py` |
| Classes | PascalCase | `DatabaseManager`, `GraphService` |
| Functions | snake_case | `get_memory_by_path` |
| Constants | UPPER_SNAKE | `ROOT_NODE_UUID`, `DEFAULT_POOL_SIZE` |
| Private | Leading underscore | `_coerce_pool`, `_record_rows` |
| Pydantic models | PascalCase | `CreateMemoryRequest`, `DiffResponse` |

---

## Key Architectural Patterns

1. **Namespace isolation** — Every query filters by `namespace` (from `X-Namespace` header). Multi-agent memory spaces share one DB.
2. **Changeset tracking** — MCP write tools record before/after row states via `ChangeCollector` → `ChangesetStore`. Human Dashboard edits bypass this.
3. **Domain prefixes** — URIs follow `domain://path` format. Valid domains configured in `config.json`.
4. **Config as source of truth** — `config.json` is the sole config source. `.env` is read-only migration source, never written to.
