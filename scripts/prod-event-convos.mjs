// Lists a user's prod conversations, optionally for one event (id, time, people, line/hint counts).
// Usage: node scripts/prod-event-convos.mjs <api> <user-id> [event-id]
const [api, user, eventId] = process.argv.slice(2);
const res = await fetch(`${api}/api/conversations`, { headers: { "x-user-id": user } });
const all = await res.json();
console.log("total", all.length);
for (const c of all.filter((c) => !eventId || c.eventId === eventId).sort((a, b) => b.startedAt - a.startedAt))
  console.log(c.id, c.eventId, new Date(c.startedAt).toLocaleString(), c.participants.map((p) => p.name).join(","), c.transcript.length, c.hints.length);
