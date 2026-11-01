// Chunk 5 · Small helpers shared by the follow-ups screen and the tab badge.
import type { Conversation, FollowUp } from "@larp/shared";

/** Nudged by the cron (or "skip a week"), or simply past due. */
export const isDue = (f: FollowUp) => f.status === "nudged" || (f.status === "open" && f.dueAt <= Date.now());

/** The conversations merged into a follow-up, oldest first. */
export const conversationsOf = (f: FollowUp, cs: Conversation[]) => {
  const ids = f.conversationIds.length ? f.conversationIds : [f.conversationId];
  return cs.filter((c) => ids.includes(c.id)).sort((a, b) => a.startedAt - b.startedAt);
};

/** "send them the deck" -> "Send them the deck". */
export const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const CHANGED = "larp:followups-changed";
/** Tell the tab badge to recount after a nudge or a "mark sent". */
export const announceChange = () => window.dispatchEvent(new Event(CHANGED));
export const onChange = (fn: () => void) => {
  window.addEventListener(CHANGED, fn);
  return () => window.removeEventListener(CHANGED, fn);
};
