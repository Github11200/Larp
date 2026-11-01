// Ad-hoc: time one askJson call per tier to see if the LLM provider is slow or hanging.
// Usage (from server/): npx tsx --env-file=../.env scripts/llm-ping.ts
import { z } from "zod";
import { env } from "../src/env";
import { askJson, type ModelTier } from "../src/lib/llm";

for (const model of ["smart", "fast"] as ModelTier[]) {
  const t = Date.now();
  const out = await Promise.race([
    askJson(z.object({ word: z.string() }), { model, prompt: "Give one word for 'hello'." }).then((r) => JSON.stringify(r)),
    new Promise<string>((r) => setTimeout(() => r("TIMEOUT 45s"), 45_000)),
  ]).catch((e: Error) => `ERROR ${e.message.slice(0, 200)}`);
  console.log(model, model === "smart" ? env.llmSmartModel : env.llmFastModel, `${Date.now() - t}ms`, out);
}
process.exit(0);
