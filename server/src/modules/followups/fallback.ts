// Chunk 5 · Write-up without an LLM: regex promises, quoted highlights, a templated draft.
// Used instantly when a conversation ends, and as the final answer when no LLM key is set.
import type { Conversation, Event, Profile, Utterance } from "@larp/shared";
import { firstName, type Who } from "./participants";

export interface PersonWriteUp {
  promises: string[];
  theirPromises: string[];
  learned: string[];
  draft: string;
  dueInDays: number;
}

export interface WriteUp {
  summary: string;
  learned: string[];
  moments: string[];
  namesHeard: string[];
  people: Map<string, PersonWriteUp>;
}

// "I'll", "I’ll" (curly, as phones type it), "I will", "I'm going to", "let me".
const PROMISE = /\b(?:I(?:'|’)ll|I will|I(?:'|’)m going to|I am going to|let me(?! know))\s+(.+)/i;
const FACT = /\b(?:I(?:'|’)m|I am|I work|I run|I build|we(?:'|’)re|we are|my )\b/i;
const NAME_INTRO = /\b(?:I(?:'|’)m|my name(?:'|’)s|my name is|this is)\s+([A-Z][a-z]+)\b/g;

/** "Sure, I'll send you my deck." -> "send them your deck": reads as "You told Sam you'd send them your deck". */
export function promiseFrom(text: string): string | undefined {
  const m = text.match(PROMISE);
  if (!m) return undefined;
  return m[1]
    .replace(/[.!?]+$/, "")
    .replace(/\byours\b/gi, "theirs")
    .replace(/\byour\b/gi, "their")
    .replace(/\byou\b/gi, "them")
    .replace(/\bmy\b/gi, "your")
    .replace(/\bme\b/gi, "you")
    .trim();
}

/** The mic can't tell speakers apart, so "unknown" lines count as yours: you're the one wearing the earpiece. */
const isMine = (u: Utterance) => u.speaker !== "them";

export function promisesIn(transcript: Utterance[], mine: boolean): string[] {
  const lines = transcript.filter((u) => isMine(u) === mine);
  return [...new Set(lines.map((u) => promiseFrom(u.text)).filter((p): p is string => !!p))];
}

const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function fallbackWriteUp(conv: Conversation, who: Who[], profile: Profile | null, event: Event | null): WriteUp {
  const t = conv.transcript;
  const minutes = Math.max(1, Math.round(((conv.endedAt ?? Date.now()) - conv.startedAt) / 60000));
  const withWhom = who.length ? who.map((w) => firstName(w.name)).join(" and ") : "someone";
  const opener = t.find((u) => u.speaker !== "me") ?? t[0];
  const summary = `${minutes} min with ${withWhom}${opener ? `. It opened with "${clip(opener.text)}"` : ""}.`;

  const learned = t.filter((u) => u.speaker !== "me" && FACT.test(u.text)).map((u) => clip(u.text)).slice(0, 3);
  const moments = [
    ...conv.linksShared.map((l) => `You flashed your ${l.label} link.`),
    ...conv.hints.slice(0, 2).map((h) => `Coach whispered: "${h.text}"`),
  ];
  const namesHeard = [...new Set(t.filter((u) => u.speaker !== "me").flatMap((u) => [...u.text.matchAll(NAME_INTRO)].map((m) => m[1])))];

  const promises = promisesIn(t, true);
  const theirPromises = promisesIn(t, false);
  const people = new Map<string, PersonWriteUp>();
  for (const w of who) {
    people.set(w.name, {
      promises,
      theirPromises,
      learned,
      draft: fallbackDraft(w, promises, conv, profile, event),
      dueInDays: t.some((u) => /\btomorrow\b/i.test(u.text)) ? 1 : 7,
    });
  }
  return { summary, learned, moments, namesHeard, people };
}

function fallbackDraft(who: Who, promises: string[], conv: Conversation, profile: Profile | null, event: Event | null): string {
  const lines = [`Hey ${firstName(who.name)}! Great meeting you${event ? ` at ${event.name}` : ""}.`];
  if (promises.length) lines.push(`Like I said, I'd ${promises[0].replace(/\byour\b/g, "my").replace(/\bthem\b/g, "you").replace(/\btheir\b/g, "your")}: [link]`);
  const link = conv.linksShared[0];
  if (link) lines.push(`Here's my ${link.label} again: ${link.url}`);
  const common = who.person?.dossier?.commonGround[0];
  lines.push(common ? `Would love to keep nerding out about ${common.toLowerCase()}.` : "Let's keep in touch!");
  if (profile) lines.push(`- ${firstName(profile.name)}`);
  return lines.join("\n");
}
