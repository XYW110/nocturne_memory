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
├── emotion_service.py         # EmotionService — emotion dimension management
├── relationship_service.py    # RelationshipService — relationship type management
├── templates_service.py       # TemplatesService — soul template CRUD operations
├── template_loader.py         # TemplateLoader — template loading and variable substitution
├── relations.py               # Relationship enum and validation
├── entrypoint.sh              # Docker entrypoint (config generation, permissions)
│
├── api/                       # REST API routers (FastAPI)
│   ├── __init__.py            # Exports all routers
│   ├── browse.py              # /api/browse/* — memory CRUD
│   ├── review.py              # /api/review/* — changeset review/rollback
│   ├── maintenance.py         # /api/maintenance/* — cleanup ops
│   ├── settings.py            # /api/settings/* — config management
│   ├── presets.py             # /api/presets/* — boot URI presets
│   ├── emotion.py             # /api/emotion/* — emotion dimension operations
│   ├── relationship.py        # /api/relationship/* — relationship management
│   ├── templates.py           # /api/templates/* — soul template CRUD
│   └── utils.py               # Shared API helpers (text diff)
│
├── db/                        # Database layer
│   ├── __init__.py            # Singleton getters (get_db_manager, etc.)
│   ├── database.py            # DatabaseManager (engine, sessions)
│   ├── models.py              # ORM models (Node, Memory, Edge, Path, SoulTemplate, etc.)
│   ├── graph.py               # GraphService — core graph operations
│   ├── glossary.py            # GlossaryService — keyword bindings
│   ├── search.py              # SearchIndexer — FTS index management
│   ├── search_terms.py        # CJK-aware search term extraction
│   ├── snapshot.py            # ChangesetStore — before/after tracking
│   ├── namespace.py           # Namespace resolution middleware helper
│   ├── presets.py             # PresetService — boot URI presets CRUD
│   ├── neo4j_client.py        # Legacy Neo4j client (migration only)
│   └── migrations/            # Schema migration runner
│       ├── runner.py
│       └── 015_v2.6.0_add_soul_template_system.py  # SoulTemplate table migration
│
├── templates/                 # Soul template definitions
│   ├── default.json           # Default soul template (persona + memory nodes)
│   └── relationships.json     # Relationship definitions with emotion initial values
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
│   ├── __init__.py
│   └── migrate_neo4j_to_sqlite.py
│
└── tests/                     # Test suite
    ├── conftest.py            # Pytest fixtures
    ├── test_soul_templates.py # Soul template system tests
    ├── api/                   # API integration tests
    │   ├── test_api_routes.py
    │   └── test_presets_api.py
    ├── mcp/                   # MCP tool tests
    │   ├── test_mcp_namespace.py
    │   └── test_mcp_tools.py
    ├── service/               # Service unit tests
    │   ├── test_glossary_service.py
    │   ├── test_graph_service.py
    │   ├── test_namespace_isolation.py
    │   └── test_search_indexer.py
    └── unit/                  # Unit tests
        ├── test_auth.py
        ├── test_locales.py
        ├── test_search_terms.py
        └── test_snapshot.py
```

---

## Module Organization Rules

### API Routers (`api/`)
- One router per resource domain (browse, review, settings, presets, maintenance, emotion, relationship, templates)
- Each router defines its own Pydantic request models inline (not in `models/schemas.py`)
- Shared response models live in `models/schemas.py`
- Routers are registered in `web_app.py` via `api.include_router()`

### Database Layer (`db/`)
- **Services are singletons** — accessed via `get_db_manager()`, `get_graph_service()`, etc. from `db/__init__.py`
- `database.py` is infrastructure-only: engine, session factory, migrations
- `graph.py` contains all node/memory/edge/path business logic
- `models.py` defines ORM models and shared utilities (`serialize_row`, `escape_like_literal`)
- `soul_templates` table stores user-defined soul templates

### Service Layer (Root-level)
- `emotion_service.py` — EmotionService: manages 6 emotion dimensions (trust, closeness, respect, dependency, security, resonance)
- `relationship_service.py` — RelationshipService: manages relationship types and their behaviors
- `templates_service.py` — TemplatesService: CRUD operations for soul templates
- `template_loader.py` — TemplateLoader: loads templates from JSON files with variable substitution (`{{variable}}`)

### Template Definitions (`templates/`)
- `default.json` — Default soul template containing persona variables and memory node definitions
- `relationships.json` — Relationship definitions with behavioral guidelines and initial emotion values per relationship type

### Entry Points
- `main.py` — Web-only mode (REST API + SPA)
- `run_sse.py` — MCP SSE transport (also hosts admin UI)
- `mcp_server.py` — MCP stdio transport (auto-launches embedded admin UI)
- `entrypoint.sh` — Docker entrypoint: config generation, path normalization, permissions setup

---

## Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Files | snake_case | `graph.py`, `search_terms.py`, `emotion_service.py` |
| Classes | PascalCase | `DatabaseManager`, `GraphService`, `EmotionService` |
| Functions | snake_case | `get_memory_by_path`, `init_emotions_for_relationship` |
| Constants | UPPER_SNAKE | `ROOT_NODE_UUID`, `DEFAULT_POOL_SIZE`, `EMOTION_DIMENSIONS` |
| Private | Leading underscore | `_coerce_pool`, `_record_rows`, `_load_relationships` |
| Pydantic models | PascalCase | `CreateMemoryRequest`, `DiffResponse`, `InitExistingRequest` |
| Enums | PascalCase (str, Enum) | `Relationship` |

---

## Key Architectural Patterns

1. **Namespace isolation** — Every query filters by `namespace` (from `X-Namespace` header). Multi-agent memory spaces share one DB.
2. **Changeset tracking** — MCP write tools record before/after row states via `ChangeCollector` → `ChangesetStore`. Human Dashboard edits bypass this.
3. **Domain prefixes** — URIs follow `domain://path` format. Valid domains configured in `config.json`.
4. **Config as source of truth** — `config.json` is the sole config source. `.env` is read-only migration source, never written to.
5. **Soul Template System** — Templates define persona variables and memory nodes with `{{variable}}` placeholders. Applied via `apply_template()` which substitutes variables and creates/updates nodes.
6. **Emotion Dimensions** — 6 emotional axes (trust, closeness, respect, dependency, security, resonance) stored on Edge model. Initial values vary by relationship type.
7. **Relationship System** — Relationship types define behavioral guidelines and initial emotion values. AI can request relationship changes via MCP tool.
8. **Docker Single-Container** — SQLite-only deployment with bind mounts to `/opt/nocturne-memory`. Frontend embedded as static files.
9. **Persistent Path Normalization** — `entrypoint.sh` auto-fixes outdated database_url paths (///app/data/, D:/, d:/) to ///app/persistent/data/
