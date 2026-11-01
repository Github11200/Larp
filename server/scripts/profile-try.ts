// Builds a profile from real links and prints it. Usage: npx tsx --env-file=../.env scripts/profile-try.ts <url-or-notes>...
import { db } from "../src/lib/db";
import { llmAvailable } from "../src/lib/llm";
import { buildProfile } from "../src/modules/profile/build";

const notes = process.argv.slice(2).join(" ");
await db.profiles.put("try", { id: "me", name: "", headline: "", summary: "", skills: [], projects: [], links: [], status: "pending" });
const t = Date.now();
await buildProfile({ userId: "try", urls: [], notes });
console.log(`llm=${llmAvailable} ${Date.now() - t}ms`);
console.log(JSON.stringify(await db.profiles.get("try", "me"), null, 2));
