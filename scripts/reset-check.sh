#!/bin/bash
# Local check of /api/dev/reset: seed a user, reset keeping profile, reset fully.
cd "$(dirname "$0")/../server"
PORT=4791 DATABASE_URL= REDIS_URL= npx tsx src/server.ts >/tmp/reset-check.log 2>&1 &
PID=$!; trap "kill $PID" EXIT
for i in $(seq 30); do curl -s localhost:4791/health >/dev/null && break; sleep 0.5; done
H=(-H "x-user-id: reset-test" -H "content-type: application/json")
curl -s -XPOST "${H[@]}" localhost:4791/api/dev/seed; echo
node ../scripts/prod-inventory.mjs reset-test http://localhost:4791
curl -s -XPOST "${H[@]}" -d '{"keepProfile":true}' localhost:4791/api/dev/reset; echo
node ../scripts/prod-inventory.mjs reset-test http://localhost:4791
curl -s -XPOST "${H[@]}" -d '{}' localhost:4791/api/dev/reset; echo
node ../scripts/prod-inventory.mjs reset-test http://localhost:4791
