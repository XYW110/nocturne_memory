"""
Docker deployment setup for Nocturne Memory.

Generates config.json with Docker-appropriate defaults (SQLite, no external DB).

Usage:
  python scripts/setup_docker.py
  python scripts/setup_docker.py --port 8080   # custom app port
"""

import json
import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OPT_DIR = Path("/opt/nocturne-memory")
CONFIG_PATH = OPT_DIR / "config.json"


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Setup Nocturne Memory for Docker deployment")
    parser.add_argument("--port", type=int, default=None, help="App port (default: 80)")
    parser.add_argument("--force", action="store_true", help="Overwrite existing config")
    args = parser.parse_args()

    # --- Read existing config ---
    existing_config = {}
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                existing_config = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass

    # --- Resolve API token ---
    if args.force:
        api_token = generate_token(32)
    else:
        api_token = existing_config.get("api_token") or generate_token(32)

    # --- Resolve App port ---
    app_port = args.port if args.port is not None else 80

    # --- config.json (App SSOT) ---
    docker_required = {
        "database_url": "sqlite+aiosqlite:////app/data/nocturne.db",
        "host": "0.0.0.0",
        "web_port": 8233,
        "auto_open_browser": False,
        "api_token": api_token,
    }
    docker_defaults = {
        "valid_domains": ["core", "writer", "game", "notes", "narrative"],
        "boot_uris": {
            "": [
                "core://agent",
                "core://operating_principles",
                "core://philosophy",
                "core://agent/showroom_quality",
                "core://agent/preferences",
                "core://my_user",
            ]
        },
        "cors_origins": None,
        "public_readonly_mcp": False,
    }

    if CONFIG_PATH.exists() and not args.force:
        config = dict(existing_config)
        patched = [k for k, v in docker_required.items() if config.get(k) != v]
        config.update(docker_required)
        for k, v in docker_defaults.items():
            config.setdefault(k, v)
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
            f.write("\n")
        if patched:
            print(f"[OK] Updated {CONFIG_PATH} (patched: {', '.join(patched)})")
        else:
            print(f"[OK] {CONFIG_PATH} already up to date")
    else:
        config = dict(docker_defaults)
        config.update(docker_required)
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"[OK] Generated {CONFIG_PATH}")

    # --- Create host directories for bind mounts ---
    for subdir in ("data", "snapshots", "backups"):
        sub_path = OPT_DIR / subdir
        sub_path.mkdir(parents=True, exist_ok=True)
        print(f"[OK] {sub_path}")

    print()
    print("=" * 60)
    print("  Nocturne Memory — Docker Setup Complete")
    print("=" * 60)
    print()
    print("  Architecture: single container (SQLite, no external DB)")
    print()
    print("  Next steps:")
    print("    docker compose up -d --build")
    print()
    print("  Note for Linux users:")
    print("    sudo chown 1000 config.json")
    print()
    port_suffix = "" if app_port == 80 else f":{app_port}"
    print(f"  Dashboard:  http://localhost{port_suffix}")
    print(f"  SSE:        http://localhost{port_suffix}/sse")
    print(f"  HTTP MCP:   http://localhost{port_suffix}/mcp")
    print()
    print(f"  API Token:")
    print(f"    {api_token}")
    print()
    print("  MCP client config example:")
    print(f'    "url": "http://<your-ip>{port_suffix}/mcp"')
    print(f'    "headers": {{"Authorization": "Bearer {api_token}"}}')
    print()


if __name__ == "__main__":
    main()
