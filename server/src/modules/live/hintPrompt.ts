// Chunk 1 · Prompts for the earpiece coach. Reply format is two lines so it parses without JSON mode:
//   line 1: who said the last line ("me" / "them" / "none")
//   line 2: the whisper (max ~8 words) or "-" for silence
import type { Speaker, Utterance } from "@larp/shared";
import type { LiveContext } from "./session";

const HISTORY_LINES = 12;

/** Stable per conversation (profile + dossier), so the provider can cache it. */
export function buildSystem(ctx: LiveContext): string {
  const { profile: me, person: them } = ctx;
  const d = them?.dossier;
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
    "",
    "THE OTHER PERSON (labeled THEM):",
    them
      ? [
          `${them.name}${them.headline ? `: ${them.headline}` : ""}`,
          d && `About: ${d.summary}`,
          d && `Working on: ${d.workingOn.join("; ")}`,
          d && `Interests: ${d.interests.join("; ")}`,
          d && `Common ground: ${d.commonGround.join("; ")}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "Unknown stranger.",
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
    "ideally a callback to something about THEM. Plain words, no quotes, no labels, no preamble.",
    "If ME said the last line, line 2 is -.",
  ].join("\n");
}

export function turnPrompt(transcript: Utterance[]): string {
  return `Conversation so far:\n${formatTranscript(transcript)}`;
}

export function stallPrompt(transcript: Utterance[]): string {
  return [
    `Conversation so far:\n${formatTranscript(transcript)}`,
    "",
    "It has gone quiet for several seconds. Line 1: none. Line 2: one hint to restart the conversation.",
  ].join("\n");
}

export function parseReply(text: string): { speaker?: Exclude<Speaker, "unknown">; hint?: string } {
  const [first = "", ...rest] = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const who = first.toLowerCase().replace(/[^a-z]/g, "");
  const speaker = who === "me" ? "me" : who === "them" ? "them" : undefined;
  const hint = rest.join(" ").replace(/^(line 2:|hint:)\s*/i, "").replace(/^["']|["']$/g, "").trim();
  return { speaker, hint: hint && hint !== "-" ? hint : undefined };
}

const LABEL: Record<Speaker, string> = { me: "ME", them: "THEM", unknown: "?" };

function formatTranscript(transcript: Utterance[]): string {
  return transcript
    .slice(-HISTORY_LINES)
    .map((u) => `${LABEL[u.speaker]}: ${u.text}`)
    .join("\n");
}
