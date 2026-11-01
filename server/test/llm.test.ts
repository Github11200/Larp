// LLM routing: tiers pick their provider by model id, and an OpenAI failure falls back to Baseten.
import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { env } from "../src/env";
import { askJson } from "../src/lib/llm";

const reply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }));
const calls: { url: string; body: Record<string, unknown> }[] = [];
function mockFetch(...responses: Response[]) {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return responses.shift()!;
  });
}
Object.assign(env, { basetenKey: "b", openaiKey: "o", llmSmartModel: "openai:gpt-6.1-terra", llmSmartFallback: "zai-org/GLM-5.3-Fast" });
afterEach(() => {
  calls.length = 0;
  vi.unstubAllGlobals();
});
const City = z.object({ city: z.string() });

test("smart tier goes to OpenAI with its own token + reasoning params", async () => {
  mockFetch(reply('{"city":"Ottawa"}'));
  expect(await askJson(City, { prompt: "capital?" })).toEqual({ city: "Ottawa" });
  expect(calls[0].url).toContain("api.openai.com");
  expect(calls[0].body).toMatchObject({ model: "gpt-6.1-terra", max_completion_tokens: 2000, reasoning_effort: "none" });
  expect(calls[0].body).not.toHaveProperty("chat_template_kwargs");
});

test("OpenAI rate limit falls back to the Baseten model", async () => {
  mockFetch(new Response("rate limited", { status: 429 }), reply('{"city":"Ottawa"}'));
  expect(await askJson(City, { prompt: "capital?" })).toEqual({ city: "Ottawa" });
  expect(calls[1].url).toContain("baseten");
  expect(calls[1].body).toMatchObject({ model: "zai-org/GLM-5.3-Fast", max_tokens: 2000 });
});

test("no OpenAI key goes straight to the fallback", async () => {
  env.openaiKey = undefined;
  mockFetch(reply('{"city":"Ottawa"}'));
  await askJson(City, { prompt: "capital?" });
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toContain("baseten");
  env.openaiKey = "o";
});
