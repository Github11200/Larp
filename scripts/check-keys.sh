#!/usr/bin/env bash
# Lists the Baseten models and ElevenLabs voices available to the keys in .env (never prints the keys).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
echo "== Baseten models"
curl -sf https://inference.baseten.co/v1/models -H "Authorization: Bearer $BASETEN_API_KEY" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>JSON.parse(s).data.forEach(m=>console.log(m.id)))'
echo "== ElevenLabs voices (premade)"
curl -sf "https://api.elevenlabs.io/v2/voices?page_size=100&voice_type=default" -H "xi-api-key: $ELEVENLABS_API_KEY" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>JSON.parse(s).voices.forEach(v=>console.log(v.voice_id, v.name, JSON.stringify(v.labels))))'
