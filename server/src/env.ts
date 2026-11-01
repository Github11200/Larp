// All config in one place. Missing optional values switch the app to local fallbacks.
export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL || undefined,
  redisUrl: process.env.REDIS_URL || undefined,
  elevenLabsKey: process.env.ELEVENLABS_API_KEY || undefined,
  /** Whisper voice. Default is a premade neutral voice. */
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
  /** Turbo v2.5 benched as fast as Flash v2.5 for short whispers (~200ms to first audio) with better quality. */
  elevenLabsTtsModel: process.env.ELEVENLABS_TTS_MODEL || "eleven_turbo_v2_5",
  /** LLM keys. Baseten runs the live path; OpenAI runs prep + follow-ups. No keys = features fall back to stubs. */
  basetenKey: process.env.BASETEN_API_KEY || undefined,
  openaiKey: process.env.OPENAI_API_KEY || undefined,
  /** Model ids. "openai:<id>" goes to OpenAI, anything else to Baseten. Fast = live hints, benched fastest on Baseten. */
  llmFastModel: process.env.LLM_FAST_MODEL || "zai-org/GLM-5.2-Fast",
  llmSmartModel: process.env.LLM_SMART_MODEL || "openai:gpt-6.1-terra",
  /** Must accept images (guest-list screenshots). */
  llmVisionModel: process.env.LLM_VISION_MODEL || "openai:gpt-6.1-terra",
  /** Baseten stand-ins when an OpenAI call fails (no key, rate limit, outage). */
  llmSmartFallback: process.env.LLM_SMART_FALLBACK || "zai-org/GLM-5.3-Fast",
  llmVisionFallback: process.env.LLM_VISION_FALLBACK || "deepseek-ai/DeepSeek-V4.1-Flash-Fast",
  /** Exa web search for person research (chunk 4). Unset = dossiers use only what the guest list had. */
  exaKey: process.env.EXA_API_KEY || undefined,
  /** Comma-separated origins allowed to call the API (the Render static site URL). Unset = any. */
  webOrigins: origins(process.env.WEB_ORIGIN),
};

/** Browsers send "https://host" exactly; tolerate what people paste into a dashboard (trailing slash, no scheme, caps). */
function origins(raw = ""): string[] | undefined {
  const list = raw
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, "").toLowerCase())
    .filter(Boolean)
    .map((s) => (/^https?:\/\//.test(s) ? s : `https://${s}`));
  return list.length ? list : undefined;
}
