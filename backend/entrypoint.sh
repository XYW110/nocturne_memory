#!/bin/sh

set -e

PERSISTENT_DIR="${PERSISTENT_DIR:-/app/persistent}"

mkdir -p "$PERSISTENT_DIR/data" "$PERSISTENT_DIR/snapshots" "$PERSISTENT_DIR/backups"

if [ ! -f "$PERSISTENT_DIR/config.json" ]; then
    echo "[INFO] Generating config.json in persistent directory..."
    
    API_TOKEN=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
    
    cat > "$PERSISTENT_DIR/config.json" << EOF
{
  "database_url": "sqlite+aiosqlite:////app/persistent/data/nocturne.db",
  "db_pool_size": 5,
  "db_max_overflow": 5,
  "valid_domains": ["core", "writer", "game", "notes", "narrative"],
  "boot_uris": {
    "": ["core://agent", "core://operating_principles", "core://philosophy", "core://agent/showroom_quality", "core://agent/preferences", "core://my_user"]
  },
  "host": "0.0.0.0",
  "web_port": 8233,
  "auto_open_browser": false,
  "api_token": "$API_TOKEN",
  "cors_origins": null,
  "public_readonly_mcp": false,
  "locale": null
}
EOF
    echo "[INFO] Generated $PERSISTENT_DIR/config.json"
    echo "[INFO] API Token: $API_TOKEN"
fi

export CONFIG_PATH="$PERSISTENT_DIR/config.json"
export SNAPSHOT_DIR="$PERSISTENT_DIR/snapshots"
export BACKUP_DIR="$PERSISTENT_DIR/backups"

exec python run_sse.py
