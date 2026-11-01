// Chunk 1 · Decides when to whisper and what. The core demo moment.
import type { LiveListener } from "./session";

export const hintsListener: LiveListener = {
  name: "hints",
  async onUtterance(ctx, u) {
    // TODO(chunk 1): decide if a hint helps (question asked, conversation stalled), then
    // streamText({ model: "fast", system: <profile + dossier, stable>, prompt: <recent transcript> })
    // and whisper the first sentence as soon as it arrives.
    // Stub: answer questions from "them" with a dossier opener.
    if (u.speaker !== "them" || !u.text.trim().endsWith("?")) return;
    const opener = ctx.person?.dossier?.openers[0];
    await ctx.whisper(opener ? `Then ask: ${opener}` : "Answer, then ask what they're building");
  },
};
