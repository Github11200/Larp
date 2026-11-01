#!/usr/bin/env bash
# Merges an agent branch into the current branch (main), then runs tests + typecheck on in-memory store / inline jobs.
# Stops on conflict so they can be resolved by hand. Never pushes.
# Usage: scripts/merge-verify.sh [branch]   (no branch = just verify)
set -euo pipefail
cd "$(dirname "$0")/.."
[ -n "${1:-}" ] && git merge --no-ff --no-edit "$1"
npm install --silent
export DATABASE_URL= REDIS_URL=
log=$(mktemp)
npm test 2>&1 | grep -E "Test Files|Tests |FAIL" || true
if npm run typecheck >"$log" 2>&1; then echo "typecheck ok"; else grep -E "error TS" /tmp/larp-typecheck.log; echo "TYPECHECK FAILED"; exit 1; fi
