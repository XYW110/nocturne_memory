# Error Handling

> How errors are handled in Nocturne Memory backend.

---

## Overview

Two distinct error handling contexts:
1. **REST API** — FastAPI `HTTPException` with JSON responses
2. **MCP Tools** — String error messages returned to the AI agent

---

## Error Types

### Built-in Exceptions Used

| Exception | Context | When |
|-----------|---------|------|
| `ValueError` | Service layer | Business logic validation failures |
| `HTTPException` | API layer | HTTP error responses |
| `RuntimeError` | Startup | Fatal config/DB connection failures |
| `ConfigWriteError` | Config layer | `config.json` write permission denied |

### Custom Exceptions

```python
# backend/config.py
class ConfigWriteError(Exception):
    """Raised when config.json cannot be written due to permissions."""
    pass
```

---

## API Error Handling Pattern

### Standard Flow: Service → Router → Response

```python
# Service layer raises ValueError
async def create_memory(self, ...):
    if not content:
        raise ValueError("Content cannot be empty")

# Router catches and converts to HTTPException
@router.post("/node")
async def create_node(body: CreateMemoryRequest):
    try:
        result = await graph.create_memory(...)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"success": True, ...}
```

### Status Code Conventions

| Code | Usage |
|------|-------|
| 200 | Success |
| 400 | Bad request (reserved domain names, etc.) |
| 401 | Unauthorized (missing/invalid Bearer token) |
| 404 | Resource not found |
| 409 | Conflict (domain in use, boot URI references) |
| 422 | Validation error (from `ValueError`) |
| 500 | Internal error (config write failures) |

### Error Response Format

```json
{"detail": "Human-readable error message"}
```

---

## MCP Error Handling Pattern

MCP tools return error strings, not exceptions:

```python
@mcp.tool()
async def read_memory(uri: str) -> str:
    try:
        content = await fetch_and_format_memory(uri)
        return content
    except Exception as e:
        return f"Error: {str(e)}"
```

**Rules:**
- Success returns content string
- Error returns `"Error: <message>"` prefixed string
- Never let exceptions propagate to the MCP transport

---

## ConfigWriteError Handler

Registered as FastAPI exception handler in `web_app.py`:

```python
@api.exception_handler(ConfigWriteError)
async def config_write_error_handler(request, exc):
    return JSONResponse(status_code=500, content={"detail": str(exc)})
```

---

## i18n in Error Messages

Use `t()` from `locales` for user-facing error messages:

```python
from locales import t

raise HTTPException(status_code=404, detail=t("api.browse.path_not_found").format(uri=uri))
```

- API errors: use `t()` with locale-aware keys
- MCP errors: English only (consumed by AI models)
- Startup errors: English with actionable troubleshooting steps

---

## Forbidden Patterns

1. **Bare `except:`** — Always specify exception type
2. **Swallowing exceptions silently** — At minimum, log to stderr
3. **Returning None for errors** — Raise or return error string, never silent None
4. **Generic 500 for business errors** — Use 422 for validation, 409 for conflicts
5. **Exposing internal details** — Never include stack traces in API responses

---

## Common Mistakes

1. **Forgetting `.format()` on i18n strings** — `t("key")` returns a template; call `.format()` with args
2. **Using HTTPException in service layer** — Services raise `ValueError`; routers convert to `HTTPException`
3. **Inconsistent error prefix in MCP** — Always prefix with `"Error: "` for AI consumption
4. **Not catching ValueError in routers** — Every router endpoint that calls a service must catch `ValueError`
