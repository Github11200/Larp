// Provider-agnostic LLM helpers shared by all chunks. Feature code calls only these functions,
// so the provider (and models) can be picked or swapped here without touching any chunk.
// Add prompts in your own module, not here.
// Provider: Baseten Model APIs (OpenAI-compatible chat completions).
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
}

/** False when no provider key is set; callers should fall back to their stub. */
export const llmAvailable = Boolean(env.basetenKey);

const BASE_URL = "https://inference.baseten.co/v1";

/** One call, typed JSON back, validated against the schema. */
export async function askJson<S extends z.ZodType>(schema: S, ask: Ask): Promise<z.output<S>> {
  const res = await complete(ask, "smart", false, {
    response_format: {
      type: "json_schema",
      json_schema: { name: "result", schema: z.toJSONSchema(schema), strict: true },
    },
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

async function complete(ask: Ask, defaultTier: ModelTier, stream: boolean, extra: object = {}): Promise<Response> {
  if (!env.basetenKey) throw new Error("LLM provider not configured (set BASETEN_API_KEY)");
  const tier = ask.model ?? defaultTier;
  const user = ask.images?.length
    ? [{ type: "text", text: ask.prompt }, ...ask.images.map((url) => ({ type: "image_url", image_url: { url } }))]
    : ask.prompt;
  const messages = [...(ask.system ? [{ role: "system", content: ask.system }] : []), { role: "user", content: user }];
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.basetenKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: { fast: env.llmFastModel, smart: env.llmSmartModel, vision: env.llmVisionModel }[tier],
      messages,
      max_tokens: ask.maxTokens ?? (tier === "fast" ? 100 : 2000),
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
