#!/usr/bin/env bash
# Run api + web on alternate ports (3100/5273) so a second checkout can run beside `npm run dev`.
cd "$(dirname "$0")/.."
PORT=3100 npm run dev -w server &
VITE_API_URL=http://localhost:3100 npx -w web vite --port 5273 --strictPort &
wait
