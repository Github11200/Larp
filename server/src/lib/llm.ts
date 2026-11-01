// Provider-agnostic LLM helpers shared by all chunks. Feature code calls only these functions,
// so the provider (and models) can be picked or swapped here without touching any chunk.
// Add prompts in your own module, not here.
// Providers: Baseten Model APIs and OpenAI, both chat-completions shaped. A model id "openai:<id>" picks OpenAI.
import { z } from "zod";
import { env } from "../env";

/** Which tier of model to use. Map tiers to concrete models in the provider implementation. */
export type ModelTier =
  /** Live path (hints): latency beats depth. */
  | "fast"
  /** Prep path (profile, dossiers, follow-ups): quality beats latency. */
  | "smart"
  /** Reads images (e.g. guest-list screenshots). */
  | "vision";

export interface Ask {
  model?: ModelTier;
  /** Stable context (profile, dossier). Keep it identical between calls so providers can cache it. */
  system?: string;
  prompt: string;
  maxTokens?: number;
  /** Image data URLs (data:image/...;base64,...) sent with the prompt. Needs the "vision" tier. */
  images?: string[];
  /** Abort a call that's taking too long (e.g. AbortSignal.timeout on the live path). */
  signal?: AbortSignal;
}

/** False when no provider key is set; callers should fall back to their stub. */
export const llmAvailable = Boolean(env.basetenKey || env.openaiKey);

interface Provider {
  url: string;
  key(): string | undefined;
  /** Provider-specific knobs: token cap name and how to skip thinking (it only burns tokens and latency here). */
  params(maxTokens: number): object;
}
const providers: Record<"baseten" | "openai", Provider> = {
  baseten: {
    url: "https://inference.baseten.co/v1/chat/completions",
    key: () => env.basetenKey,
    params: (n) => ({ max_tokens: n, chat_template_kwargs: { enable_thinking: false, thinking: false } }),
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    key: () => env.openaiKey,
    params: (n) => ({ max_completion_tokens: n, ...OPENAI_REASONING }),
  },
};
/** Set from scripts/check-openai.sh: the lowest reasoning setting gpt-6.1-terra accepts. */
const OPENAI_REASONING = { reasoning_effort: "none" };

const modelFor = { fast: () => env.llmFastModel, smart: () => env.llmSmartModel, vision: () => env.llmVisionModel };
/** Baseten stand-ins for OpenAI tiers, so prep still works through a missing key, rate limit, or outage. */
const fallbackFor: Partial<Record<ModelTier, () => string>> = { smart: () => env.llmSmartFallback, vision: () => env.llmVisionFallback };

function route(model: string): { provider: Provider; id: string } {
  return model.startsWith("openai:") ? { provider: providers.openai, id: model.slice(7) } : { provider: providers.baseten, id: model };
}

/** One call, typed JSON back, validated against the schema. */
export async function askJson<S extends z.ZodType>(schema: S, ask: Ask): Promise<z.output<S>> {
  const res = await complete(ask, "smart", false, {
    // Not strict: OpenAI's strict mode rejects optional fields; zod validates the result below anyway.
    response_format: { type: "json_schema", json_schema: { name: "result", schema: z.toJSONSchema(schema), strict: false } },
  });
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  return schema.parse(JSON.parse(stripFences(body.choices[0].message.content)));
}

/** Streamed text, yielded as it arrives. Use on the live path so TTS can start early. */
export async function* streamText(ask: Ask): AsyncGenerator<string> {
  const res = await complete(ask, "fast", true);
  for await (const data of sseData(res.body!)) {
    if (data === "[DONE]") return;
    const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/** One request to the tier's model; an OpenAI failure retries once on the tier's Baseten fallback. */
async function complete(ask: Ask, defaultTier: ModelTier, stream: boolean, extra: object = {}): Promise<Response> {
  const tier = ask.model ?? defaultTier;
  const primary = modelFor[tier]();
  const fallback = route(primary).provider === providers.openai ? fallbackFor[tier]?.() : undefined;
  try {
    return await request(primary, tier, ask, stream, extra);
  } catch (e) {
    if (!fallback || ask.signal?.aborted) throw e;
    console.warn(`[llm] ${primary} failed, using ${fallback}: ${(e as Error).message.slice(0, 160)}`);
    return request(fallback, tier, ask, stream, extra);
  }
}

async function request(model: string, tier: ModelTier, ask: Ask, stream: boolean, extra: object): Promise<Response> {
  const { provider, id } = route(model);
  const key = provider.key();
  if (!key) throw new Error(`LLM provider for ${model} not configured`);
  const user = ask.images?.length
    ? [{ type: "text", text: ask.prompt }, ...ask.images.map((url) => ({ type: "image_url", image_url: { url } }))]
    : ask.prompt;
  const messages = [...(ask.system ? [{ role: "system", content: ask.system }] : []), { role: "user", content: user }];
  const res = await fetch(provider.url, {
    method: "POST",
    signal: ask.signal,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: id,
      messages,
      ...provider.params(ask.maxTokens ?? (tier === "fast" ? 200 : 2000)),
      stream,
      ...extra,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

/** Yields the payload of each `data:` line of a server-sent event stream. */
async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of body) {
    buf += decoder.decode(chunk, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines) if (line.startsWith("data:")) yield line.slice(5).trim();
  }
}

function stripFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
}
