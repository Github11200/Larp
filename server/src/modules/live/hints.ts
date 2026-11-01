// Chunk 1 · Decides when to whisper and what. The core demo moment.
// One fast LLM call per line does two jobs: works out who said it (the mic can't tell),
// and decides whether a hint helps. A few quiet seconds also earns a hint to restart the chat.
// Questions get answered fast: a "?" in the live transcript starts the answer before the line is even done,
// and it's whispered the moment the line is final, if the final line still asks it (partials get misheard).
// When a prepped person turns up mid-chat (name caught or tapped), the coach tells you who they are.
import type { Person, Speaker, Utterance } from "@larp/shared";
import { llmAvailable, streamText } from "../../lib/llm";
import { contentWords, isEchoOfHint, repeatsHint, type LiveContext, type LiveListener } from "./session";
import { buildSystem, linesSinceMe, nudgePrompt, parseReply, stallPrompt, turnPrompt, unfinishedPrompt } from "./hintPrompt";

type Reply = ReturnType<typeof parseReply>;

const STALL_MS = 12_000;
/** A lull right after a whisper is the user saying it or thinking: no restart hint then. */
const STALL_AFTER_HINT_MS = 15_000;
/** Back-to-back whispers talk over each other; this keeps at most one per window. */
const COOLDOWN_MS = 4000;
/** A hint later than this is useless anyway, and must not hold up saving the conversation. */
const LLM_TIMEOUT_MS = 3000;
/** Quiet for this many lines while others talk = left out of the chat; offer a way in. */
const JOIN_AFTER_LINES = 3;
/** At most one "way in" nudge per window, so the coach doesn't nag while you pick your moment. */
const JOIN_EVERY_MS = 20_000;
/** Lets the speech-to-text settle a just-heard "?" before hinting on it. */
const QUESTION_SETTLE_MS = 200;

interface HintState {
  /** Bumped on every line; a stall hint whose quiet spell was broken by a new line is dropped. */
  seq: number;
  /** Bumped per hint request. A hint is dropped once a newer request's hint has been spoken. */
  req: number;
  spokenReq: number;
  /** The line still being spoken, and how many of its questions were seen. */
  partial: string;
  questionsSeen: number;
  /** An answer fetched while the question was still being spoken; whispered only once the line is final and still asks it. */
  early?: { question: string; reply: Promise<Reply> };
  questionTimer?: NodeJS.Timeout;
  lastHintAt: number;
  /** How long the last whisper takes to say; even an urgent hint waits it out instead of cutting it off. */
  lastHintMs: number;
  lastJoinAt: number;
  stallTimer?: NodeJS.Timeout;
  /** Prepped people already introduced (or there from the start), so each gets one "that's X" whisper. */
  introduced: Set<string>;
  /** Stub mode cycles through openers instead of repeating the first. */
  stubTurn: number;
}
const states = new WeakMap<LiveContext, HintState>();
const stateOf = (ctx: LiveContext) =>
  states.get(ctx) ??
  states
    .set(ctx, {
      seq: 0,
      req: 0,
      spokenReq: 0,
      partial: "",
      questionsSeen: 0,
      lastHintAt: 0,
      lastHintMs: 0,
      lastJoinAt: 0,
      introduced: new Set(ctx.people.map((p) => p.id)),
      stubTurn: 0,
    })
    .get(ctx)!;

export const hintsListener: LiveListener = {
  name: "hints",
  onPartial(ctx, text, speaker) {
    const st = stateOf(ctx);
    clearTimeout(st.stallTimer); // someone is talking, so no stall
    if (speaker === "me" || !llmAvailable) return;
    // The user reading a hint aloud (hints end in questions) or the mic hearing the whisper: not a question for the user.
    const hints = ctx.conversation.hints;
    if (repeatsHint(text, hints) || isEchoOfHint(text, hints)) return;
    st.partial = text;
    const questions = countQuestions(text);
    if (questions <= st.questionsSeen) return;
    st.questionsSeen = questions;
    clearTimeout(st.questionTimer);
    st.questionTimer = setTimeout(() => ctx.track(unfinishedHint(ctx, st)), QUESTION_SETTLE_MS);
    st.questionTimer.unref();
  },
  async onUtterance(ctx, u) {
    const st = stateOf(ctx);
    const seq = ++st.seq;
    // The finished line replaces the in-progress one; an answer fetched mid-line is used below if it still fits.
    clearTimeout(st.questionTimer);
    const early = st.early;
    st.early = undefined;
    st.partial = "";
    st.questionsSeen = 0;
    clearTimeout(st.stallTimer);
    st.stallTimer = setTimeout(() => ctx.track(stallHint(ctx, seq)), STALL_MS);
    st.stallTimer.unref();

    const newcomer = ctx.people.find((p) => !st.introduced.has(p.id));
    if (newcomer) {
      st.introduced.add(newcomer.id);
      return whisper(ctx, st, intro(newcomer), true);
    }
    if (!llmAvailable) return stubHint(ctx, st, u);
    if (u.speaker === "me") return; // you don't need a hint for what you just said
    if (early && (await speakEarly(ctx, st, u, early))) return;
    const joinIn = leftOut(ctx, st);
    const urgent = countQuestions(u.text) > 0;
    const { reply } = await askHint(ctx, st, turnPrompt(ctx.conversation.transcript, ctx.conversation.hints, { joinIn }), urgent);
    if (u.speaker === "unknown" && reply.speaker) ctx.setSpeaker(u, reply.speaker);
  },
  async onNudge(ctx) {
    const st = stateOf(ctx);
    clearTimeout(st.stallTimer);
    clearTimeout(st.questionTimer);
    if (!llmAvailable) {
      const hint = stubOpener(ctx, st);
      if (hint) await whisper(ctx, st, hint, true);
      return;
    }
    // The user asked for help: answer even if the coach thinks they spoke last or the chat moved on.
    await askHint(ctx, st, nudgePrompt(ctx.conversation.transcript, ctx.conversation.hints), true, { force: true });
  },
  onEnd(ctx) {
    const st = stateOf(ctx);
    clearTimeout(st.stallTimer);
    clearTimeout(st.questionTimer);
  },
};

/** A question heard mid-line: hint now rather than after the speaker (and the user's reply) pauses. */
async function unfinishedHint(ctx: LiveContext, st: HintState): Promise<void> {
  if (!st.partial || ctx.conversation.endedAt) return;
  const reply = ask(ctx, unfinishedPrompt(ctx.conversation.transcript, ctx.conversation.hints, st.partial))
    .then(parseReply)
    .catch((e): Reply => (console.error("[live:hints] question", e), {}));
  st.early = { question: lastQuestion(st.partial), reply };
  await reply;
}

/**
 * Whispers the answer fetched mid-line, now that the line is final. Partials get revised ("what are you wearing" becomes
 * "working on") or belong to the user, so it's only spoken if the final line still asks the same question
 * and the coach didn't judge the user asked it. False: fall back to a normal hint for the line.
 */
async function speakEarly(ctx: LiveContext, st: HintState, u: Utterance, early: NonNullable<HintState["early"]>): Promise<boolean> {
  const reply = await early.reply;
  if (!reply.hint || reply.speaker === "me" || !stillAsks(u.text, early.question)) return false;
  if (u.speaker === "unknown") ctx.setSpeaker(u, "them");
  if (!claim(st, true)) return true;
  st.spokenReq = ++st.req;
  st.lastHintMs = whisperMs(reply.hint);
  await ctx.whisper(reply.hint);
  return true;
}

/** The last question in a line still being spoken. */
const lastQuestion = (text: string) => text.split(/(?<=[.!?])\s+/).filter((s) => s.includes("?")).at(-1) ?? text;

/** Most of the question's distinctive words made it into the final line. */
function stillAsks(line: string, question: string): boolean {
  const asked = contentWords(question);
  if (!asked.length) return line.includes("?");
  const said = new Set(contentWords(line));
  return asked.filter((w) => said.has(w)).length / asked.length >= 0.6;
}

/**
 * Asks for a hint and whispers it, unless a hint from a newer request already went out. `urgent` (a question) skips the cooldown.
 * Stays quiet when the coach judges the user said the line (else it answers the user's own questions),
 * and when the chat moved on while it thought.
 * `force`: the user asked (nudge), so none of that holds it back.
 */
async function askHint(
  ctx: LiveContext,
  st: HintState,
  prompt: string,
  urgent: boolean,
  { force = false } = {},
): Promise<{ reply: Reply; spoken: boolean }> {
  const req = ++st.req;
  const heard = ctx.conversation.transcript.length;
  const reply = parseReply(await ask(ctx, prompt));
  const ok = force || (reply.speaker !== "me" && req > st.spokenReq && !movedOn(ctx, heard));
  if (!reply.hint || !ok || !(force || claim(st, urgent))) return { reply, spoken: false };
  st.lastHintAt = Date.now();
  st.spokenReq = req;
  st.lastHintMs = whisperMs(reply.hint!);
  await ctx.whisper(reply.hint!);
  return { reply, spoken: true };
}

/** Since the request: the user spoke, or someone said something newer than the line being answered. */
function movedOn(ctx: LiveContext, heard: number): boolean {
  const since = ctx.conversation.transcript.slice(heard);
  return since.length > 0;
}

const whisperMs = (text: string) => 2500 + 300 * text.split(/\s+/).length;

/** Claims the nudge window when true, so lines arriving close together can't each ask for one. */
function leftOut(ctx: LiveContext, st: HintState): boolean {
  if (ctx.conversation.participants.length < 2) return false; // 1:1: nobody to be left out by
  if (linesSinceMe(ctx.conversation.transcript) < JOIN_AFTER_LINES || Date.now() - st.lastJoinAt < JOIN_EVERY_MS) return false;
  st.lastJoinAt = Date.now();
  return true;
}

async function stallHint(ctx: LiveContext, seq: number): Promise<void> {
  const st = stateOf(ctx);
  if (st.seq !== seq || ctx.conversation.endedAt || Date.now() - st.lastHintAt < STALL_AFTER_HINT_MS) return;
  try {
    const hint = llmAvailable
      ? parseReply(await ask(ctx, stallPrompt(ctx.conversation.transcript, ctx.conversation.hints))).hint
      : stubOpener(ctx, st);
    if (hint && st.seq === seq) await whisper(ctx, st, hint);
  } catch (e) {
    console.error("[live:hints] stall", e); // timer callback: nothing upstream to catch it
  }
}

async function ask(ctx: LiveContext, prompt: string): Promise<string> {
  const t0 = Date.now();
  let text = "";
  const signal = AbortSignal.timeout(LLM_TIMEOUT_MS);
  for await (const delta of streamText({ model: "fast", system: buildSystem(ctx), prompt, maxTokens: 200, signal })) text += delta;
  console.log(`[live:hints] llm ${Date.now() - t0}ms -> ${JSON.stringify(text)}`);
  return text;
}

async function whisper(ctx: LiveContext, st: HintState, text: string, urgent = false): Promise<void> {
  if (!claim(st, urgent)) return;
  st.lastHintMs = whisperMs(text);
  await ctx.whisper(text);
}

/** Takes the whisper slot. `urgent` skips the cooldown: a question to answer, or who just walked up, beats any other hint. */
function claim(st: HintState, urgent: boolean): boolean {
  const since = Date.now() - st.lastHintAt;
  if (since < (urgent ? st.lastHintMs : Math.max(COOLDOWN_MS, st.lastHintMs))) return false;
  st.lastHintAt = Date.now();
  return true;
}

/** "That's Priya. Ask about LLM evals": the dossier, compressed to one breath. */
function intro(p: Person): string {
  const first = p.name.split(" ")[0];
  const topic = p.dossier?.workingOn[0] ?? p.dossier?.commonGround[0];
  return topic ? `That's ${first}. Ask about ${lowerFirst(topic)}` : `That's ${first}. Ask what they're building`;
}

/** No LLM: answer their questions with an opener, and nudge you in when you've been left out. */
async function stubHint(ctx: LiveContext, st: HintState, u: Utterance): Promise<void> {
  if (!isThem(u.speaker)) return;
  if (u.text.trim().endsWith("?")) return whisper(ctx, st, stubOpener(ctx, st));
  if (!leftOut(ctx, st)) return;
  await whisper(ctx, st, JOIN_IN[st.stubTurn++ % JOIN_IN.length]);
}

const JOIN_IN = ["Jump in: ask how they got into that", "Add your take, then ask theirs", "Ask the quiet one what they think"];

const GENERAL = ["Answer, then ask what they're building", "Ask what brought them here", "Ask their name, then use it"];

function stubOpener(ctx: LiveContext, st: HintState): string {
  const openers = ctx.people.flatMap((p) => p.dossier?.openers ?? []);
  const i = st.stubTurn++;
  return openers.length ? `Then ask: ${openers[i % openers.length]}` : GENERAL[i % GENERAL.length];
}

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const isThem = (s: Speaker) => s !== "me";
const countQuestions = (text: string) => text.split("?").length - 1;
