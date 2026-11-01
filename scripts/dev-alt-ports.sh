#!/usr/bin/env bash
# Runs api :3013 + web :5183 so a second worktree can run alongside the main `npm run dev`.
set -euo pipefail
cd "$(dirname "$0")/.."
npx concurrently -n api,web \
  "cd server && PORT=3013 npx tsx --env-file-if-exists=../.env src/server.ts" \
  "cd web && VITE_API_URL=http://localhost:3013 npx vite --port 5183 --strictPort"
