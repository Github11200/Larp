// Times the real hint prompt on candidate fast models. Picks LLM_FAST_MODEL.
// Usage: npx tsx --env-file=../.env scripts/bench-hints.ts [model ...]
import { demoPeople, demoProfile, type Utterance } from "@larp/shared";
import { env } from "../src/env";
import { streamText } from "../src/lib/llm";
import { buildSystem, turnPrompt } from "../src/modules/live/hintPrompt";
import type { LiveContext } from "../src/modules/live/session";

const models = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["zai-org/GLM-5.3-Fast", "deepseek-ai/DeepSeek-V4.1-Flash-Fast", "zai-org/GLM-5.2-Fast", "moonshotai/Kimi-K3", "openai/gpt-oss-120b"];

const line = (speaker: Utterance["speaker"], text: string): Utterance => ({ speaker, text, at: 0 });
const cases: Utterance[][] = [
  [line("unknown", "Hey! So what are you working on?")],
  [line("them", "Hey! So what are you working on?"), line("unknown", "An earpiece that coaches you while you network."), line("unknown", "Oh cool, how do you keep the latency down?")],
  [line("unknown", "I just got back from a climbing trip actually.")],
];
const person = demoPeople.find((p) => p.dossier)!;
const ctx = {
  profile: demoProfile,
  people: [person],
  event: null,
  conversation: { participants: [{ name: person.name, personId: person.id }] },
} as unknown as LiveContext;

for (const model of models) {
  env.llmFastModel = model;
  for (const transcript of cases) {
    const t0 = Date.now();
    let first = 0;
    let text = "";
    try {
      for await (const d of streamText({ model: "fast", system: buildSystem(ctx), prompt: turnPrompt(transcript, []), maxTokens: Number(process.env.HINT_MAX_TOKENS ?? 200) })) {
        first ||= Date.now() - t0;
        text += d;
      }
      console.log(`${model.padEnd(40)} first ${String(first).padStart(5)}ms total ${String(Date.now() - t0).padStart(5)}ms  ${JSON.stringify(text)}`);
    } catch (e) {
      console.log(`${model.padEnd(40)} ERROR ${(e as Error).message.slice(0, 120)}`);
      break;
    }
  }
}
