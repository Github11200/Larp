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
    "",
    "Reply with exactly two lines and nothing else:",
    "Line 1: who said the LAST line: me or them (or none if told so). If it mixes both, whoever asked the question in it.",
    "Line 2: the hint, or - if no hint helps.",
    "",
    "The user says your hint out loud almost word for word. So write it as their own words: first person, plain spoken English,",
    "at most 14 words, easy to say. No jargon, no semicolons, no labels, no quotes, no 'Ask them...' or 'Mention...' instructions.",
    "",
    "When THEM asks the user something (about their work, an opinion, news, small talk), ANSWER it.",
    "Start with the user's actual take or a concrete fact, confident and specific. Never dodge a question with a question.",
    "You may end with a short question back. If you don't know the topic well, still give a sensible honest take.",
    "Use the user's profile only when it fits what was asked; don't pitch their work out of nowhere.",
    "When nobody asked anything, hint only if the user seems stuck: one natural thing to say, ideally a callback to something THEM said.",
    "If ME said the last line, line 2 is -. Exception: ME only stalled (um, good question, yeah so) after a question; then answer it.",
    "Refer to other people by name or they/them; never guess gender.",
    "If you know little about THEM, keep it human: what they're working on, common ground, or (if unknown) their name.",
    ...(group ? ["In a group, use names and pull in whoever has been quiet."] : []),
    "",
    "Examples of line 2:",
    "THEM: Did you hear about the Anthropic IPO? -> Yeah, wild. I think it'll make model pricing way more competitive. You?",
    "THEM: What do you do? -> (the user's role and current project in one plain sentence) What about you?",
    "THEM: I'm building voice agents for dentists. -> Nice, are they answering calls live or doing follow-ups?",
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

/** Lines said since the user last spoke. In a group, others can talk past you for a while. */
export function linesSinceMe(transcript: Utterance[]): number {
  const last = transcript.map((u) => u.speaker).lastIndexOf("me");
  return transcript.length - 1 - last;
}

/** A question heard before its line finished. Hinted right away so the user isn't left filling dead air. */
export function unfinishedPrompt(transcript: Utterance[], hints: Hint[], partial: string): string {
  const now: Utterance = { speaker: "unknown", text: partial, at: Date.now() };
  return [
    context([...transcript, now], hints),
    "",
    "The last line is still being spoken and contains a question. If it was asked to the user, line 2 answers it.",
  ].join("\n");
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
