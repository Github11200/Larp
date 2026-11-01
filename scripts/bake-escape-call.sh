#!/usr/bin/env bash
# Pre-bakes the fake caller's voice for the live-mode escape call, so it plays instantly with no keys.
# Usage: scripts/bake-escape-call.sh [voice_id]   (default: a premade ElevenLabs voice, not the coach's)
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
voice=${1:-EXAVITQu4vr4xnSDxMaL}
text="Hey! Sorry, sorry, I know you're at that event. Can you step out for a sec? I really need you right now. ... Hello? Can you hear me?"
curl -sS -f "https://api.elevenlabs.io/v1/text-to-speech/$voice?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "content-type: application/json" \
  -d "{\"text\": \"$text\", \"model_id\": \"eleven_multilingual_v2\"}" \
  -o web/public/escape-call.mp3
ls -l web/public/escape-call.mp3
