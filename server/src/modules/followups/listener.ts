// Chunk 5 · Turns a finished conversation into a follow-up.
import { db, newId } from "../../lib/db";
import type { LiveListener } from "../live/session";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export const followUpsListener: LiveListener = {
  name: "followups",
  async onEnd(ctx) {
    const { conversation, person } = ctx;
    if (conversation.transcript.length === 0) return;
    // TODO(chunk 5): askJson({ summary, promises, draft }, { model: "smart", prompt: <transcript> }).
    // Stub: lines where you said "I'll ..." count as promises.
    const promises = conversation.transcript.filter((u) => u.speaker === "me" && /\bI('ll| will)\b/i.test(u.text)).map((u) => u.text);
    await db.followUps.put(ctx.userId, {
      id: newId(),
      conversationId: conversation.id,
      personId: person?.id,
      personName: person?.name ?? "Someone you met",
      summary: `[stub] ${conversation.transcript.length} lines`,
      promises,
      draft: `Hey ${person?.name ?? "there"}, great meeting you!`,
      dueAt: Date.now() + WEEK,
      status: "open",
    });
  },
};
