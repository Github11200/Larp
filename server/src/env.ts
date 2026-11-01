// All config in one place. Missing optional values switch the app to local fallbacks.
export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL || undefined,
  redisUrl: process.env.REDIS_URL || undefined,
  elevenLabsKey: process.env.ELEVENLABS_API_KEY || undefined,
  /** Whisper voice. Default is a premade neutral voice. */
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
  /** LLM via Baseten Model APIs (OpenAI-compatible). Unset = features fall back to stubs. */
  basetenKey: process.env.BASETEN_API_KEY || undefined,
  llmFastModel: process.env.LLM_FAST_MODEL || "moonshotai/Kimi-K2-Instruct-0905",
  llmSmartModel: process.env.LLM_SMART_MODEL || "deepseek-ai/DeepSeek-V3.1",
  /** Comma-separated origins allowed to call the API (the Render static site URL). Unset = any. */
  webOrigins: process.env.WEB_ORIGIN?.split(",").map((s) => s.trim()),
};
