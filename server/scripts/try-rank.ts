// Reruns attendee ranking on a saved event (people.json, events.json, profile.json from prod) to debug failures.
// Usage: cd server && npx tsx --env-file=../.env scripts/try-rank.ts <dir-with-json>
import { readFileSync } from "node:fs";
import { rankGuests } from "../src/modules/prep/rank";

const dir = process.argv[2];
const read = (f: string) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
const people = read("people.json");
const t = Date.now();
try {
  const ranks = await rankGuests(people, read("profile.json"), read("events.json")[0]);
  console.log(`ok in ${Date.now() - t}ms`);
  people.forEach((p: { name: string }, i: number) => console.log(ranks[i].score?.toFixed(2), p.name, "|", ranks[i].why));
} catch (e) {
  console.error(`FAILED after ${Date.now() - t}ms:`, e);
}
