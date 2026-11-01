// Replays real conversations through the current hint prompt, next to the hint prod actually gave.
// For tuning the coach on real tests instead of made-up ones.
// Usage: npx tsx --env-file=../.env scripts/replay-hints.ts <api-url> <user-id> [model ...]
import { Conversation, Person, Profile, type Utterance } from "@larp/shared";
import { z } from "zod";
import { env } from "../src/env";
import { streamText } from "../src/lib/llm";
import { buildSystem, parseReply, turnPrompt } from "../src/modules/live/hintPrompt";
import type { LiveContext } from "../src/modules/live/session";

const [api, user, ...models] = process.argv.slice(2);
if (!api || !user) throw new Error("usage: replay-hints.ts <api-url> <user-id> [model ...]");

async function get<S extends z.ZodType>(path: string, schema: S): Promise<z.output<S>> {
  const res = await fetch(`${api.replace(/\/+$/, "")}${path}`, { headers: { "x-user-id": user } });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return schema.parse(await res.json());
}

const profile = await get("/api/profile", Profile.nullable());
const conversations = await get("/api/conversations", z.array(Conversation));

for (const model of models.length ? models : [env.llmFastModel]) {
  env.llmFastModel = model;
  console.log(`\n##### ${model}`);
  for (const c of conversations.sort((a, b) => a.startedAt - b.startedAt)) {
    const people = (await Promise.all(c.participants.filter((p) => p.personId).map((p) => get(`/api/people/${p.personId}`, Person).catch(() => null)))).filter(
      (p): p is Person => p !== null,
    );
    const ctx = { profile, people, event: null, conversation: c } as unknown as LiveContext;
    console.log(`\n=== ${c.participants.map((p) => p.name).join(", ") || "stranger"}`);
    for (const [i, u] of c.transcript.entries()) {
      console.log(`  ${u.speaker.toUpperCase().padEnd(7)} ${u.text}`);
      if (u.speaker === "me") continue;
      const next = c.transcript[i + 1]?.at ?? Infinity;
      const prodHint = c.hints.find((h) => h.at >= u.at && h.at < next)?.text ?? "(none)";
      const lines: Utterance[] = c.transcript.slice(0, i + 1).map((l, j) => (j === i ? { ...l, speaker: "unknown" } : l));
      const t0 = Date.now();
      let text = "";
      for await (const d of streamText({ model: "fast", system: buildSystem(ctx), prompt: turnPrompt(lines, c.hints.filter((h) => h.at < u.at)), maxTokens: 200 })) text += d;
      console.log(`      before: ${prodHint}`);
      console.log(`      after:  ${parseReply(text).hint ?? "(silent)"}   [${Date.now() - t0}ms]`);
    }
  }
}
