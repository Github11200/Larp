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
echo "== ElevenLabs TTS models"
curl -sf https://api.elevenlabs.io/v1/models -H "xi-api-key: $ELEVENLABS_API_KEY" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>JSON.parse(s).filter(m=>m.can_do_text_to_speech).forEach(m=>console.log(m.model_id,"|",m.name,"|",(m.description||"").slice(0,110))))' \
  || echo "(key can't list models)"
