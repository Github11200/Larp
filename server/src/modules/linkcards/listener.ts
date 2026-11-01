// Chunk 2 · Live link cards. Owns: this folder, web/src/features/linkcards.
// Runs on partial transcripts with no LLM, so the card appears while they're still asking.
import type { LinkKind } from "@larp/shared";
import type { LiveListener } from "../live/session";

// TODO(chunk 2): tune phrases, handle "where can I find you", "send me your stuff", etc.
const TRIGGERS: [RegExp, LinkKind][] = [
  [/\b(demo|try it|see it)\b/i, "demo"],
  [/\bgit ?hub\b/i, "github"],
  [/\blinked ?in\b/i, "linkedin"],
  [/\b(portfolio|website)\b/i, "portfolio"],
  [/\b(resume|cv)\b/i, "resume"],
];

export const linkCardsListener: LiveListener = {
  name: "linkcards",
  onPartial(ctx, text, speaker) {
    if (speaker === "me") return;
    for (const [pattern, kind] of TRIGGERS) {
      if (!pattern.test(text)) continue;
      const link = ctx.profile?.links.find((l) => l.kind === kind);
      if (link) ctx.shareLink(link);
    }
  },
};
