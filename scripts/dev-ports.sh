#!/usr/bin/env bash
# Runs api + web on chosen ports so several sessions can share one worktree.
# Usage: scripts/dev-ports.sh <apiPort> <webPort>
set -euo pipefail
cd "$(dirname "$0")/.."
api=${1:-3030} web=${2:-5200}
npx concurrently -n api,web \
  "cd server && PORT=$api npx tsx --env-file-if-exists=../.env src/server.ts" \
  "cd web && VITE_API_URL=http://localhost:$api npx vite --port $web --strictPort"
