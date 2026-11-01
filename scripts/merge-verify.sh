#!/usr/bin/env bash
# Merges an agent branch into the current branch (main), then runs tests + typecheck on in-memory store / inline jobs.
# Stops on conflict so they can be resolved by hand. Never pushes.
# Usage: scripts/merge-verify.sh <branch>
set -euo pipefail
cd "$(dirname "$0")/.."
git merge --no-ff --no-edit "$1"
export DATABASE_URL= REDIS_URL=
npm test 2>&1 | grep -E "Test Files|Tests |FAIL" || true
npm run typecheck 2>&1 | grep -E "error" && exit 1 || echo "typecheck ok"
