// All config in one place. Missing optional values switch the app to local fallbacks.
export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL || undefined,
  redisUrl: process.env.REDIS_URL || undefined,
  elevenLabsKey: process.env.ELEVENLABS_API_KEY || undefined,
  /** Comma-separated origins allowed to call the API (the Render static site URL). Unset = any. */
  webOrigins: process.env.WEB_ORIGIN?.split(",").map((s) => s.trim()),
};
