// Runs the follow-up write-up against the real LLM (needs BASETEN_API_KEY in .env). No DB/Redis.
// Usage: cd server && DATABASE_URL= REDIS_URL= npx tsx --env-file-if-exists=../.env ../scripts/followups-llm-try.ts
import { demoEvent, demoPeople, demoProfile } from "@larp/shared";
import { writeUp } from "../server/src/modules/followups/writeup";

const now = Date.now();
const lines: [string, string][] = [
  ["unknown", "Hey, I'm Sam. What are you working on?"],
  ["unknown", "An earpiece that whispers what to say at networking events."],
  ["unknown", "Ha, that's wild. How do you keep the latency down?"],
  ["unknown", "Streaming STT and a fast model. I’ll send you the deck tomorrow."],
  ["unknown", "Please do. I can intro you to our CTO, she'd love this."],
];
const t0 = Date.now();
const out = await writeUp(
  { id: "c1", personId: "p-sam", eventId: demoEvent.id, participants: [], startedAt: now - 180000, endedAt: now, hints: [], linksShared: [],
    transcript: lines.map(([speaker, text]) => ({ speaker: speaker as "unknown", text, at: now })) },
  [{ name: "Sam Chen", personId: "p-sam", person: demoPeople[0] }],
  demoProfile,
  demoEvent,
  [],
);
console.log(`${Date.now() - t0}ms`);
console.log(JSON.stringify({ ...out, people: Object.fromEntries(out.people) }, null, 2));
