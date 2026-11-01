// Provider-agnostic LLM helpers shared by all chunks. Feature code calls only these two functions,
// so the provider (and models) can be picked or swapped here without touching any chunk.
// Add prompts in your own module, not here.
import { z } from "zod";

/** Which tier of model to use. Map tiers to concrete models in the provider implementation. */
export type ModelTier =
  /** Live path (hints): latency beats depth. */
  | "fast"
  /** Prep path (profile, dossiers, follow-ups): quality beats latency. */
  | "smart";

export interface Ask {
  model?: ModelTier;
  /** Stable context (profile, dossier). Keep it identical between calls so providers can cache it. */
  system?: string;
  prompt: string;
  maxTokens?: number;
}

/** One call, typed JSON back, validated against the schema. */
export async function askJson<S extends z.ZodType>(schema: S, ask: Ask): Promise<z.output<S>> {
  // TODO(provider): call the "smart" model asking for JSON matching z.toJSONSchema(schema), then:
  // return schema.parse(JSON.parse(text));
  void schema;
  void ask;
  throw new Error("LLM provider not configured (server/src/lib/llm.ts)");
}

/** Streamed text, yielded as it arrives. Use on the live path so TTS can start early. */
export async function* streamText(ask: Ask): AsyncGenerator<string> {
  // TODO(provider): stream from the "fast" model and yield each text delta.
  void ask;
  throw new Error("LLM provider not configured (server/src/lib/llm.ts)");
}
