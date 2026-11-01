// Ad-hoc: run chunk 4's event scraper on a real URL and print what we'd get.
// Usage (from server/): npx tsx scripts/prep-try.ts <event-url>
import { scrapeEvent } from "../src/modules/prep/sources";

const page = await scrapeEvent(process.argv[2] ?? "https://lu.ma/4757x124");
console.log(page.name, "|", page.date);
console.log((page.description ?? "").slice(0, 200));
for (const g of page.guests) console.log("-", g.name, "|", g.headline ?? "", "|", g.links.length, "links", g.photoUrl ? "+photo" : "");
