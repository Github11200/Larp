// Chunk 2 · Live link cards. Owns: this folder, web/src/features/linkcards.
// Runs on partial transcripts with no LLM, so the card appears while they're still asking.
import type { Link, LinkKind, Profile } from "@larp/shared";
import type { LiveListener } from "../live/session";

/** A link kind, or a URL pattern for socials that have no kind of their own. */
type Want = LinkKind | RegExp;

// Specific asks, best link first. If none of the wanted links exist we still show *something*:
// a card with your other link beats an awkward "uh, let me find it".
const ASKS: { ask: RegExp; want: Want[] }[] = [
  { ask: /\b(demo|try it out|can i (see|try|play with) it|see it in action|is it live)\b/i, want: ["demo", "website", "portfolio"] },
  { ask: /\b(git ?hub|source code|your (code|repo))\b/i, want: ["github"] },
  { ask: /\b(linked ?in|let'?s connect|connect with you)\b/i, want: ["linkedin"] },
  { ask: /\b(portfolio|website|personal site|your site)\b/i, want: ["portfolio", "website"] },
  { ask: /\b(resume|cv)\b|résumé/i, want: ["resume", "linkedin"] },
  { ask: /\b(insta(gram)?|ig)\b/i, want: [/instagram\.com/i] },
  { ask: /\b(twitter|tweet)\b|\b(on|your) x\b/i, want: [/\b(x|twitter)\.com/i] },
];

/** Vague asks: show your first link. Only used when no specific ask matched. */
const ANY = /\b(find you (on|online)|where can i find you|your (socials|stuff|links?|handle)|send (me|over) your)\b/i;

export function linksAskedFor(profile: Profile | null, text: string): Link[] {
  const links = profile?.links ?? [];
  if (!links.length) return [];
  const asked = ASKS.filter((a) => a.ask.test(text));
  if (!asked.length) return ANY.test(text) ? [links[0]] : [];
  return asked.map(({ want }) => bestLink(links, want));
}

function bestLink(links: Link[], want: Want[]): Link {
  for (const w of want) {
    const hit = links.find((l) => (typeof w === "string" ? l.kind === w : w.test(l.url)));
    if (hit) return hit;
  }
  return links[0];
}

export const linkCardsListener: LiveListener = {
  name: "linkcards",
  onPartial(ctx, text, speaker) {
    if (speaker === "me") return;
    for (const link of linksAskedFor(ctx.profile, text)) ctx.shareLink(link);
  },
};
