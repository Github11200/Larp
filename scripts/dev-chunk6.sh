#!/usr/bin/env bash
# Runs api :3026 + web :5196 so the chunk 6 worktree can run alongside other worktrees' dev servers.
set -euo pipefail
cd "$(dirname "$0")/.."
npx concurrently -n api,web \
  "cd server && PORT=3026 npx tsx --env-file-if-exists=../.env src/server.ts" \
  "cd web && VITE_API_URL=http://localhost:3026 npx vite --port 5196 --strictPort"
