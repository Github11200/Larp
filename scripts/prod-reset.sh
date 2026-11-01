#!/bin/bash
# Wipe a prod user once the reset route is deployed. Usage: scripts/prod-reset.sh <user-id> [keepProfile=false]
API=https://larp-api.onrender.com; USER_ID=$1; KEEP=${2:-false}
for i in $(seq 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -XPOST -H "x-user-id: deploy-probe" -H "content-type: application/json" -d '{"keepProfile":true}' $API/api/dev/reset)
  [ "$code" = 200 ] && break; echo "waiting for deploy ($code)"; sleep 10
done
[ "$code" = 200 ] || { echo "reset route never came up"; exit 1; }
curl -s -XPOST -H "x-user-id: $USER_ID" -H "content-type: application/json" -d "{\"keepProfile\":$KEEP}" $API/api/dev/reset; echo
node "$(dirname "$0")/prod-inventory.mjs" "$USER_ID"
