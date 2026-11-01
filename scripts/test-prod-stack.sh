#!/usr/bin/env bash
# Runs the server tests against real Postgres + Redis + the worker (the Render setup), in throwaway Docker containers.
# Usage: scripts/test-prod-stack.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PG=larp-test-pg
KV=larp-test-kv
cleanup() {
  [[ -n "${WORKER_PID:-}" ]] && kill "$WORKER_PID" 2>/dev/null || true
  docker rm -f "$PG" "$KV" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

docker run -d --name "$PG" -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:16-alpine >/dev/null
docker run -d --name "$KV" -p 56379:6379 valkey/valkey:8-alpine >/dev/null
until docker exec "$PG" pg_isready -U postgres >/dev/null 2>&1; do sleep 0.5; done

export DATABASE_URL=postgres://postgres:pw@localhost:55432/postgres
export REDIS_URL=redis://localhost:56379

LOG=$(mktemp)
npm run worker -w server >"$LOG" 2>&1 &
WORKER_PID=$!

npm test
echo "--- worker log"
cat "$LOG"
