#!/usr/bin/env bash
# Ad-hoc: HTTP status + content type of every avatar URL in the prep cache (finds broken event photos).
cd "$(dirname "$0")/.."
for f in server/.cache/prep/event-*.json; do
  python3 -c "import json,sys; [print(g['photoUrl']) for g in json.load(open(sys.argv[1]))['guests'] if g.get('photoUrl')]" "$f"
done | sort -u | while read -r u; do
  echo "$(curl -s -o /dev/null -m 10 -w '%{http_code} %{content_type}' "$u") ${u:0:90}"
done | sort
