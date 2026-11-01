// Chunk 5 · Every finished conversation becomes notes, plus a follow-up per person we can name.
import type { LiveListener } from "../live/session";
import { startWriteUp } from "./summarize";

export const followUpsListener: LiveListener = {
  name: "followups",
  // The client waits on this before leaving live mode: quick fallback records now, the real write-up in a job.
  onEnd: (ctx) => startWriteUp(ctx.userId, ctx.conversation),
};
