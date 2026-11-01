// Ad-hoc: drive the prep API like the app does (fresh user, no profile) and print timings.
// Usage: node scripts/prep-api-try.mjs <eventUrl> [apiBase]
const [url, base = "http://localhost:3100"] = process.argv.slice(2);
const headers = { "content-type": "application/json", "x-user-id": `api-try-${Date.now()}` };
const t0 = Date.now();
const ms = () => `${Date.now() - t0}ms`;
const get = (p) => fetch(base + p, { headers }).then((r) => r.json());
const until = async (p, ok) => {
  for (let i = 0; i < 120; i++) {
    const v = await get(p);
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`timeout on ${p}`);
};

const event = await fetch(base + "/api/events", { method: "POST", headers, body: JSON.stringify({ url }) }).then((r) => r.json());
const done = await until(`/api/events/${event.id}`, (e) => e.status !== "pending");
console.log(ms(), "event", done.status, done.error ?? "");
const people = await get(`/api/events/${event.id}/people`);
console.log(ms(), "people", people.length, "top:", people[0]?.name, people[0]?.why);
await fetch(base + `/api/people/${people[0].id}/dossier`, { method: "POST", headers });
const p = await until(`/api/people/${people[0].id}`, (x) => x.dossierStatus !== "pending");
console.log(ms(), "dossier", p.dossierStatus, p.dossier?.openers?.[0] ?? "");
