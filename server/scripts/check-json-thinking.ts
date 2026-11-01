// Does the smart model reason before JSON (eating max_tokens)? Compares thinking on vs off.
// Usage (from server/): npx tsx --env-file-if-exists=../.env scripts/check-json-thinking.ts
import { env } from "../src/env";

const schema = { type: "object", properties: { people: { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } }, required: ["name", "why"], additionalProperties: false } } }, required: ["people"], additionalProperties: false };
const prompt = "Rank these 8 attendees for a voice-AI founder, one-line why each: Ada, Alan, Grace, Linus, Margaret, Ken, Barbara, Dennis.";

for (const [label, extra] of [["default", {}], ["thinking off", { chat_template_kwargs: { enable_thinking: false, thinking: false } }]] as const) {
  const t = Date.now();
  const res = await fetch("https://inference.baseten.co/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.basetenKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.PROBE_MODEL ?? env.llmSmartModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      response_format: { type: "json_schema", json_schema: { name: "result", schema, strict: true } },
      ...extra,
    }),
  });
  const body = (await res.json()) as { choices?: { finish_reason: string; message: { content?: string; reasoning_content?: string } }[]; usage?: unknown };
  const c = body.choices?.[0];
  let parsed = false;
  try { JSON.parse(c?.message.content ?? ""); parsed = true; } catch {}
  console.log(label, { status: res.status, ms: Date.now() - t, finish: c?.finish_reason, contentChars: c?.message.content?.length ?? 0, reasoningChars: c?.message.reasoning_content?.length ?? 0, parsed, usage: body.usage });
}
