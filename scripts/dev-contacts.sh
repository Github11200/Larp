#!/usr/bin/env bash
# Contacts worktree dev servers on alt ports, in-memory store + inline jobs (never the prod DB/queue from .env).
cd "$(dirname "$0")/.."
(cd server && DATABASE_URL= REDIS_URL= PORT=3061 npx tsx --env-file-if-exists=../.env src/server.ts) &
(cd web && VITE_API_URL=http://localhost:3061 npx vite --port 5221 --strictPort) &
wait
