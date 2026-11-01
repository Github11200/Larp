#!/usr/bin/env bash
# Raw Baseten streaming response for one model, to inspect fields. Usage: scripts/raw-llm.sh <model> [extra-json-fields]
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
EXTRA="${2:-}"
curl -sN https://inference.baseten.co/v1/chat/completions -H "Authorization: Bearer $BASETEN_API_KEY" -H "content-type: application/json" \
  -d "{\"model\":\"$1\",\"messages\":[{\"role\":\"user\",\"content\":\"Say hi in 3 words.\"}],\"max_tokens\":60,\"stream\":true$EXTRA}" | head -c 1500
echo
