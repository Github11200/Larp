#!/usr/bin/env bash
# Starts a profile build via the API and polls until it's no longer pending. Usage: scripts/profile-api-check.sh [apiBase]
set -euo pipefail
API=${1:-http://localhost:3013}
U="api-check-$RANDOM"
H=(-H "content-type: application/json" -H "x-user-id: $U")
curl -sf "${H[@]}" -X POST "$API/api/profile/build" -d '{"notes":"github.com/octocat linkedin.com/in/jordan-example I play ping pong"}' >/dev/null
start=$(date +%s)
for i in $(seq 1 60); do
  s=$(curl -sf "${H[@]}" "$API/api/profile" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);console.log(p.status, "|", p.name, "|", p.headline, "| links", p.links.length, "| projects", p.projects.length)})')
  echo "$(( $(date +%s) - start ))s $s"
  [[ $s == pending* ]] || exit 0
  sleep 2
done
