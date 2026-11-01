#!/usr/bin/env bash
# Lists OpenAI models matching a filter and probes one model's JSON + vision support (never prints the key).
# Usage: scripts/check-openai.sh [model] [filter]   (default gpt-6.1-terra, gpt-6)
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
model=${1:-gpt-6.1-terra} filter=${2:-gpt-6}
auth=(-H "Authorization: Bearer $OPENAI_API_KEY" -H "content-type: application/json")
echo "== models matching $filter"
curl -s https://api.openai.com/v1/models "${auth[@]}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(j.error)return console.log(j.error.message);j.data.map(m=>m.id).filter(id=>id.includes(process.argv[1])).sort().forEach(id=>console.log(id))})' "$filter"
probe() { # $1 label, $2 json body
  sleep "${GAP:-0}" # free-tier keys allow ~3 requests/min
  local t0=$(python3 -c "import time;print(int(time.time()*1000))")
  local out=$(curl -s https://api.openai.com/v1/chat/completions "${auth[@]}" -d "$2")
  local t1=$(python3 -c 'import time;print(int(time.time()*1000))')
  echo "== $1 ($((t1 - t0))ms): $(echo "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.error?"ERROR "+j.error.message:JSON.stringify(j.choices[0].message.content).slice(0,160)+" usage="+JSON.stringify(j.usage?.completion_tokens_details??j.usage))})')"
}
schema='{"type":"json_schema","json_schema":{"name":"r","strict":true,"schema":{"type":"object","properties":{"city":{"type":"string"}},"required":["city"],"additionalProperties":false}}}'
probe "json, max_completion_tokens" "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Capital of Canada?\"}],\"max_completion_tokens\":200,\"response_format\":$schema}"
probe "json, reasoning_effort=minimal" "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Capital of Canada?\"}],\"max_completion_tokens\":200,\"reasoning_effort\":\"minimal\",\"response_format\":$schema}"
probe "json, reasoning_effort=none" "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Capital of Canada?\"}],\"max_completion_tokens\":200,\"reasoning_effort\":\"none\",\"response_format\":$schema}"
probe "max_tokens (legacy)" "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Say hi\"}],\"max_tokens\":20}"
png=$(curl -s https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_92x30dp.png | base64 | tr -d '\n')
probe "vision" "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"What word is in this image? One word.\"},{\"type\":\"image_url\",\"image_url\":{\"url\":\"data:image/png;base64,$png\"}}]}],\"max_completion_tokens\":200}"
