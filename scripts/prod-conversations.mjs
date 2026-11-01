// Dumps live conversations from an API (prod by default) as a timeline: each line, then each hint
// with how long after the line it landed. For tuning the earpiece coach from real tests.
// Usage: node scripts/prod-conversations.mjs <api-url> <user-id> [how-many=3]
//   user-id: the phone's localStorage "larp.user" (or "demo" if you opened the app with ?user=demo)
const [api, user, n = "3"] = process.argv.slice(2);
if (!api || !user) {
  console.error("usage: node scripts/prod-conversations.mjs <api-url> <user-id> [how-many]");
  process.exit(1);
}

const res = await fetch(`${api.replace(/\/+$/, "")}/api/conversations`, { headers: { "x-user-id": user } });
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const convos = (await res.json()).sort((a, b) => b.startedAt - a.startedAt).slice(0, Number(n));

const clock = (t, t0) => `+${((t - t0) / 1000).toFixed(1).padStart(5)}s`;

for (const c of convos) {
  console.log(`\n=== ${c.id}  ${new Date(c.startedAt).toLocaleString()}  people: ${c.participants.map((p) => p.name).join(", ") || "-"}`);
  const events = [
    ...c.transcript.map((u) => ({ at: u.at, kind: "line", u })),
    ...c.hints.map((h) => ({ at: h.at, kind: "hint", h })),
  ].sort((a, b) => a.at - b.at);
  let lastLineAt = c.startedAt;
  for (const e of events) {
    if (e.kind === "line") {
      lastLineAt = e.at;
      const v = e.u.voice ? ` [${e.u.voice.db}dB ${e.u.voice.pitchHz ?? "?"}Hz]` : "";
      console.log(`${clock(e.at, c.startedAt)}  ${e.u.speaker.toUpperCase().padEnd(7)} ${e.u.text}${v}`);
    } else {
      console.log(`${clock(e.at, c.startedAt)}  >> HINT  ${e.h.text}   (${((e.at - lastLineAt) / 1000).toFixed(1)}s after last line)`);
    }
  }
}
