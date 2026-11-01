// Chunk 1 · Prompts for the earpiece coach. Reply format is two lines so it parses without JSON mode:
//   line 1: who said the last line ("me" / "them" / "none")
//   line 2: the whisper, words the user can say out loud (max ~14), or "-" for silence
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
    "A ? line can run two speakers together (a question, then the user starting to answer).",
    "The user says your hints out loud, so a line that resembles a hint you gave is ME, even if a name in it is misheard.",
    "Names in the transcript are often misheard: one that sounds like a person above (Junaid for Jinay) is that person, not someone new.",
    "",
    "Reply with exactly two lines and nothing else:",
    "Line 1: who said the LAST line: me or them (or none if told so). If it mixes both, whoever asked the question in it.",
    "Line 2: the hint, or - for silence.",
    "",
    "WHEN TO HINT. Line 2 is - unless one of these is true:",
    "1. The last line asks the user something (a question to them, about them, or a request for their help or opinion)",
    "   and ME hasn't answered it yet. Answer that question, never an older one.",
    "2. You are told it went quiet, the user asked for help, or to offer a way in.",
    "Everything else is -: statements (even about their own project), stories, agreement, reactions,",
    "a question ME already answered, and THEM answering a question ME asked.",
    "If ME said the last line, line 2 is -. Exception: ME only filled (um, good question, yeah so) right after THEM's question; then answer it.",
    "",
    "HOW TO HINT. The user repeats it word for word, so:",
    "- One short sentence in the user's own voice, at most 10 words. Plain spoken English, no jargon, no quotes or labels.",
    "- Facts come only from THE USER above. Never invent numbers, news, names, places, or things the user did or wore.",
    "- If the profile doesn't cover it (news, opinions, trivia), give a brief honest take or say the user hasn't followed it.",
    "- Answer directly. Don't add a question back; the user can carry the chat from there.",
    "  Only a stall/way-in hint, or a hint where the user honestly doesn't know, may be a question.",
    "- Use the user's work only when it answers what was asked. Never introduce the user twice.",
    "- For a stall with little known about THEM: what they're working on, common ground, or their name.",
    "- Refer to others by name or they/them; never guess gender.",
    ...(group ? ["- In a group, use names; a stall or way-in hint can pull in whoever has been quiet."] : []),
    "",
    "Examples (made-up people, not this conversation):",
    "THEM: What do you do? -> (the user's role and main project, under 10 words)",
    "THEM: Did you see the news about that funding round? -> Haven't caught it yet, what happened?",
    "THEM: Mostly robotics stuff for warehouses. -> -",
    "ME: No idea, do you know? / THEM: I think it was huge. -> -",
    "THEM: Do you use AI in your projects? -> (yes or no, plus one concrete project from the profile)",
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

/** `joinIn`: the others have been talking past the user, so the hint should be a way into the conversation. */
export function turnPrompt(transcript: Utterance[], hints: Hint[], { joinIn = false } = {}): string {
  return [context(transcript, hints), ...(joinIn ? ["", JOIN_IN] : [])].join("\n");
}

const JOIN_IN = [
  "The user hasn't spoken in a while and the others are talking among themselves.",
  "Unless someone just asked the user something, line 2 is a way in: a related topic, a quick take, or a flexible question",
  "that riffs on the exact topic they're on and works even if the user only half-followed it.",
  "Not a generic 'what are you building'. Still words the user says, at most 14.",
].join(" ");

/**
 * THEM lines since the user last spoke. In a group, others can talk past you for a while.
 * 0 until the user has been heard at all: unlabeled lines prove nothing about being left out.
 */
export function linesSinceMe(transcript: Utterance[]): number {
  const last = transcript.map((u) => u.speaker).lastIndexOf("me");
  if (last < 0) return 0;
  return transcript.slice(last + 1).filter((u) => u.speaker === "them").length;
}

/** A question heard before its line finished. Hinted right away so the user isn't left filling dead air. */
export function unfinishedPrompt(transcript: Utterance[], hints: Hint[], partial: string): string {
  const now: Utterance = { speaker: "unknown", text: partial, at: Date.now() };
  return [
    context([...transcript, now], hints),
    "",
    "The last line is still being spoken and contains a question. If it's asked to the user and ME hasn't answered it, line 2 answers it; otherwise -.",
  ].join("\n");
}

export function stallPrompt(transcript: Utterance[], hints: Hint[]): string {
  return [
    context(transcript, hints),
    "",
    "It has gone quiet for several seconds. Line 1: none. Line 2: one hint to restart the conversation.",
  ].join("\n");
}

/** The user asked for help: "they just said something, help me respond." Always answers, but never invents facts. */
export function nudgePrompt(transcript: Utterance[], hints: Hint[]): string {
  return [
    context(transcript, hints),
    "",
    "The user just asked for help replying to the last line from THEM. Line 1: them.",
    "Line 2: what the user says back, at most 12 words. Always give one, never -.",
    "Use only facts from the user's profile above. Never invent projects, numbers, names or experience.",
    "If the profile doesn't cover it, give an honest short line: a plain take, or admit it and ask them back.",
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
