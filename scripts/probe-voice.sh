#!/usr/bin/env bash
# Probes ElevenLabs TTS with the .env key: status + time to first byte. Writes audio to $1 (raw pcm_24000).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
VOICE="${ELEVENLABS_VOICE_ID:-21m00Tcm4TlvDq8ikWAM}"
OUT="${1:-/dev/null}"
curl -s -o "$OUT" -w "tts %{http_code} first-byte %{time_starttransfer}s total %{time_total}s bytes %{size_download}\n" \
  "https://api.elevenlabs.io/v1/text-to-speech/$VOICE/stream?output_format=pcm_24000" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "content-type: application/json" \
  -d '{"text":"Ask about their tennis app.","model_id":"eleven_flash_v2_5"}'
