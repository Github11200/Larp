// Ad-hoc: check the vision model reads names off a guest-list screenshot.
// Usage (from server/): npx tsx --env-file=../.env scripts/shots-try.ts <image.png>
import { readFile } from "node:fs/promises";
import { readScreenshots } from "../src/modules/prep/sources";

const file = process.argv[2] ?? "../scripts/.shots/prep-2-people.png";
const t = Date.now();
const guests = await readScreenshots([`data:image/png;base64,${(await readFile(file)).toString("base64")}`]);
console.log(`${guests.length} guests in ${Date.now() - t}ms`);
for (const g of guests) console.log("-", g.name, "|", g.headline ?? "");
