#!/usr/bin/env bash
# Every browser check against one fresh dev pair (in-memory store, inline jobs, never prod). Pre-merge gate for web changes.
# Usage: scripts/smoke-all.sh [apiPort] [webPort]   (default 3081 / 5241)
set -uo pipefail
cd "$(dirname "$0")/.."
API=${1:-3081} WEB=${2:-5241}
web=http://localhost:$WEB api=http://localhost:$API
scripts/dev-live.sh "$API" "$WEB" >/dev/null 2>&1 &
dev=$!
trap 'pkill -P $dev 2>/dev/null; kill $dev 2>/dev/null' EXIT
until curl -sf "$web" >/dev/null && curl -s "$api" >/dev/null; do sleep 1; done

fail=0
run() { if out=$(node "$@" 2>&1); then echo "ok   $1"; else echo "FAIL $1"; echo "$out" | tail -8 | sed "s/^/     /"; fail=1; fi; }
run scripts/ui-smoke.mjs "$web"
run scripts/followups-ui.mjs "$web"
run scripts/shots-live.mjs "$web" "$api"
run scripts/contacts-smoke.mjs "$web"
run scripts/contact-timeline.mjs "$web"
run scripts/fixes-check.mjs "$web" "$api"
exit $fail
