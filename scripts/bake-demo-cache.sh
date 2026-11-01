#!/usr/bin/env bash
# Commit pre-baked prep results so the demo is instant on Render (its disk cache is wiped every deploy).
# 1. Clear server/.cache/prep, then prep the demo event locally with the same profile the demo will use.
# 2. Run this; it copies those results into server/demo-cache/prep (read before server/.cache).
# Event pages hit for any user; rank + dossier results only hit when the profile matches exactly.
set -euo pipefail
cd "$(dirname "$0")/../server"
mkdir -p demo-cache/prep
cp -v .cache/prep/*.json demo-cache/prep/
echo "now: git add server/demo-cache && git commit -m 'Bake demo prep cache'"
