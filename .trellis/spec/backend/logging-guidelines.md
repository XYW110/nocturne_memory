# Logging Guidelines

> How logging is done in Nocturne Memory backend.

---

## Overview

The project uses **`print()` to stderr** — no structured logging library (no `logging`, no `loguru`). This is intentional: the MCP stdio transport uses stdout for protocol messages, so all diagnostic output must go to stderr.

---

## Output Patterns

### Startup Messages → stderr

```python
import sys

print("Database initialized (default lifespan).", file=sys.stderr)
print(t("startup.building"), file=sys.stderr)
```

### User-Facing Info → stdout

```python
print(f"Memory API starting on http://{host}:{port}")
print(f"Admin UI:  {ui}")
```

### Warnings → `warnings.warn()`

```python
import warnings

warnings.warn(
    "API_TOKEN is not set. The server is binding to localhost only.",
    stacklevel=2,
)
```

---

## When to Log

| Event | Output | Level |
|-------|--------|-------|
| DB initialized | stderr | Info |
| Config migrated (.env → config.json) | stderr | Info |
| Frontend build started/completed | stderr | Info |
| Presets auto-promoted | stderr | Info |
| Server started (host:port) | stdout | Info |
| Port in use | stderr | Warning |
| DB connection failed | stderr | Error (raises RuntimeError) |
| Config write permission denied | stderr | Error |
| Frontend build failed | stderr | Warning (non-fatal) |

---

## What NOT to Log

- **API tokens** — Never print `api_token` values
- **Database passwords** — Mask `parsed.password` in error messages
- **Full stack traces in API responses** — Log to stderr, return generic message to client
- **MCP protocol data** — stdout is reserved for MCP JSON-RPC

---

## i18n in Logs

Startup/diagnostic messages use `t()` for locale-aware output:

```python
from locales import t

print(t("startup.building"), file=sys.stderr)
print(t("config.demo_copied").format(demo_db=_DEMO_DB, target=target.name), file=sys.stderr)
```

MCP tool errors are always English (consumed by AI models).

---

## Common Mistakes

1. **Printing to stdout in backend code** — Use `file=sys.stderr` for all diagnostic output
2. **Using `logging` module** — The project deliberately avoids it; use `print()` with `file=sys.stderr`
3. **Exposing secrets in error messages** — Always mask passwords and tokens before printing
4. **Not using `t()` for user-facing messages** — Startup messages should be locale-aware
