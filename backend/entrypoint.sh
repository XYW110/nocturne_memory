#!/bin/sh

set -e

PERSISTENT_DIR="${PERSISTENT_DIR:-/app/persistent}"

mkdir -p "$PERSISTENT_DIR/data" "$PERSISTENT_DIR/snapshots" "$PERSISTENT_DIR/backups"

# Auto-fix database_url if it points to old paths, preserve all other settings
_fix_config() {
    if [ -f "$PERSISTENT_DIR/config.json" ]; then
        # Check if database_url needs fixing
        if grep -q '///app/data/' "$PERSISTENT_DIR/config.json" || \
           grep -q 'sqlite+aiosqlite:///D:' "$PERSISTENT_DIR/config.json" || \
           grep -q 'sqlite+aiosqlite:///d:' "$PERSISTENT_DIR/config.json"; then
            echo "[INFO] Found outdated database_url in config.json, auto-fixing..."
            
            # Use Python to preserve all other settings, only fix database_url
            python << 'EOF'
import json
import os

persistent_dir = os.environ.get('PERSISTENT_DIR', '/app/persistent')
config_path = os.path.join(persistent_dir, 'config.json')
with open(config_path, 'r', encoding='utf-8') as f:
    config = json.load(f)

config['database_url'] = 'sqlite+aiosqlite:////app/persistent/data/nocturne.db'

with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

print('[INFO] database_url fixed, other settings preserved')
EOF
            echo "[INFO] Config auto-fixed!"
        fi
    fi
}

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
else
    # Config exists, check if it needs fixing
    _fix_config
fi

export CONFIG_PATH="$PERSISTENT_DIR/config.json"
export SNAPSHOT_DIR="$PERSISTENT_DIR/snapshots"
export BACKUP_DIR="$PERSISTENT_DIR/backups"

exec python run_sse.py
