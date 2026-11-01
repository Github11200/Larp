// Runs real group chatter (user silent) through the live hint model with the "way in" nudge on.
// Usage: cd server && npx tsx --env-file=../.env ../scripts/try-join-hints.ts
import { demoProfile, type Utterance } from "@larp/shared";
import { streamText } from "../server/src/lib/llm";
import { buildSystem, parseReply, turnPrompt } from "../server/src/modules/live/hintPrompt";
import type { LiveContext } from "../server/src/modules/live/session";

const them = (text: string): Utterance => ({ speaker: "them", text, at: 0 });
const chats = [
  ["Did anyone see the keynote on agents?", "Yeah, the demo crashed twice lol", "Honestly agents are mostly hype right now", "The evals part was good though"],
  ["I'm flying to SF next week", "For the YC thing?", "Yeah, demo day prep", "Bring a jacket, it's freezing there"],
  ["The pizza ran out in like ten minutes", "Classic hackathon", "Next time we order Thai", "Thai at 2am hits different"],
].map((lines) => lines.map(them));
const ctx = {
  profile: demoProfile,
  people: [],
  event: null,
  conversation: { participants: [{ name: "Maya" }, { name: "Theo" }] },
} as unknown as LiveContext;

for (const transcript of chats) {
  const t0 = Date.now();
  let text = "";
  for await (const d of streamText({ model: "fast", system: buildSystem(ctx), prompt: turnPrompt(transcript, [], { joinIn: true }), maxTokens: 200 })) text += d;
  console.log(`${Date.now() - t0}ms  ${transcript.at(-1)!.text}  ->  ${parseReply(text).hint ?? "(none)"}`);
}
