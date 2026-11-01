// Chunk 1 · Prompts for the earpiece coach. Reply format is two lines so it parses without JSON mode:
//   line 1: who said the last line ("me" / "them" / "none")
//   line 2: the whisper (max ~8 words) or "-" for silence
import type { Hint, Person, Speaker, Utterance } from "@larp/shared";
import type { LiveContext } from "./session";

const HISTORY_LINES = 12;

/** Stable while the same people are in the conversation, so the provider can cache it. */
export function buildSystem(ctx: Pick<LiveContext, "profile" | "people" | "event" | "conversation">): string {
  const { profile: me, people, event } = ctx;
  const unknowns = ctx.conversation.participants.filter((p) => !p.personId).map((p) => p.name);
  const group = ctx.conversation.participants.length > 1;
  return [
    "You are a discreet coach whispering into the user's earpiece during a live in-person networking conversation.",
    "",
    "THE USER (labeled ME):",
    me
      ? [
          `${me.name}: ${me.headline}`,
          me.summary,
          `Skills: ${me.skills.join(", ")}`,
          ...me.projects.map((p) => `Project ${p.name}: ${p.description}`),
        ].join("\n")
      : "Unknown.",
    ...(event ? ["", `THE EVENT: ${event.name}${event.description ? ` (${event.description})` : ""}`] : []),
    "",
    group ? "THE OTHER PEOPLE (all labeled THEM; this is a group conversation):" : "THE OTHER PERSON (labeled THEM):",
    ...people.map(describe),
    ...(unknowns.length ? [`Not prepped, only know their name: ${unknowns.join(", ")}.`] : []),
    ...(people.length + unknowns.length === 0 ? ["A stranger. We don't know their name yet."] : []),
    "",
    "The mic can't tell voices apart, so some lines are labeled ?. Infer who said them from context:",
    "questions about the user's work, or things only the user would say about the user's projects, tell you who is talking.",
    "",
    "Reply with exactly two lines and nothing else:",
    "Line 1: who said the LAST line: me or them (or none if told so).",
    "Line 2: a hint for the user of at most 8 words, or - if no hint helps.",
    "",
    "Give a hint when THEM just asked the user something, or the user seems stuck.",
    "A hint is the core of a strong answer drawn from the user's profile, or a sharp follow-up question,",
    "ideally a callback to something about THEM. Plain words, no quotes, no labels, no bullets, no preamble.",
    "Refer to other people by name or they/them; never guess gender.",
    "If you know little about THEM, give a solid networking move instead: ask what they're building,",
    "find common ground, or (if their name is unknown) get their name.",
    ...(group ? ["In a group, use names and pull in whoever has been quiet."] : []),
    "If ME said the last line, line 2 is -.",
  ].join("\n");
}

function describe(p: Person): string {
  const d = p.dossier;
  return [
    `${p.name}${p.headline ? `: ${p.headline}` : ""}`,
    p.why && `Why they matter: ${p.why}`,
    d && `About: ${d.summary}`,
    d && `Working on: ${d.workingOn.join("; ")}`,
    d && `Interests: ${d.interests.join("; ")}`,
    d && `Common ground: ${d.commonGround.join("; ")}`,
    d?.openers.length && `Prepped openers: ${d.openers.join(" | ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function turnPrompt(transcript: Utterance[], hints: Hint[]): string {
  return context(transcript, hints);
}

export function stallPrompt(transcript: Utterance[], hints: Hint[]): string {
  return [
    context(transcript, hints),
    "",
    "It has gone quiet for several seconds. Line 1: none. Line 2: one hint to restart the conversation.",
  ].join("\n");
}

export function parseReply(text: string): { speaker?: Exclude<Speaker, "unknown">; hint?: string } {
  const [first = "", ...rest] = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const who = first.toLowerCase().replace(/[^a-z]/g, "");
  const speaker = who === "me" ? "me" : who === "them" ? "them" : undefined;
  const hint = rest
    .join(" ")
    .replace(/^(line 2:|hint:)\s*/i, "")
    .replace(/^[-*\u2022\u00b7\u2013\u2014]+\s+/, "") // models like to bullet the line
    .replace(/^["'\u201c]|["'\u201d]$/g, "")
    .trim();
  return { speaker, hint: hint && !/^[-.\s]*$/.test(hint) ? hint : undefined };
}

/** Past hints are listed so the coach doesn't repeat itself. */
function context(transcript: Utterance[], hints: Hint[]): string {
  const given = hints.slice(-3).map((h) => `- ${h.text}`);
  return [
    `Conversation so far:\n${formatTranscript(transcript)}`,
    ...(given.length ? ["", "Hints you already gave (don't repeat them):", ...given] : []),
  ].join("\n");
}

const LABEL: Record<Speaker, string> = { me: "ME", them: "THEM", unknown: "?" };

function formatTranscript(transcript: Utterance[]): string {
  return transcript
    .slice(-HISTORY_LINES)
    .map((u) => `${LABEL[u.speaker]}: ${u.text}`)
    .join("\n");
}
