#!/usr/bin/env bash
# Live-mode dev pair on its own ports, always on the in-memory store + inline jobs (never prod DB/Key Value).
# Usage: scripts/dev-live.sh [apiPort] [webPort]   (default 3041 / 5201)
set -euo pipefail
cd "$(dirname "$0")/.."
API=${1:-3041}
WEB=${2:-5201}
export DATABASE_URL= REDIS_URL=
npx concurrently -n api,web \
  "cd server && PORT=$API npx tsx --env-file-if-exists=../.env src/server.ts" \
  "cd web && VITE_API_URL=http://localhost:$API npx vite --port $WEB --strictPort"
