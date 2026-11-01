// Ad-hoc: run chunk 4's prep jobs end to end (in-memory store) on a real event URL and print the result.
// Usage (from server/): npx tsx --env-file=../.env scripts/prep-try.ts <event-url>
import { demoProfile } from "@larp/shared";
import { db } from "../src/lib/db";
import { prepDossier, prepEvent } from "../src/modules/prep/jobs";

const userId = "prep-try";
const url = process.argv[2] ?? "https://lu.ma/4757x124";
await db.profiles.put(userId, demoProfile);
const event = await db.events.put(userId, { id: "e1", name: url, url, status: "pending" });

let t = Date.now();
await prepEvent({ userId, eventId: event.id });
const done = await db.events.require(userId, event.id);
console.log(`\n${done.name} [${done.status}] ${done.error ?? ""} (${Date.now() - t}ms)`);
const people = (await db.people.list(userId)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
for (const p of people) console.log(`${(p.score ?? 0).toFixed(2)}  ${p.name}: ${p.why ?? "-"}`);

t = Date.now();
await prepDossier({ userId, personId: people[0].id });
const top = await db.people.require(userId, people[0].id);
console.log(`\nDossier for ${top.name} [${top.dossierStatus}] (${Date.now() - t}ms)`);
console.log(JSON.stringify(top.dossier, null, 2));
