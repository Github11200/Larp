// Chunk 1 · Decides when to whisper and what. The core demo moment.
// One fast LLM call per line does two jobs: works out who said it (the mic can't tell),
// and decides whether a hint helps. A few quiet seconds also earns a hint to restart the chat.
// Questions get answered fast: a "?" in the live transcript fires a hint before the line is even done,
// because the user fills ("um, good question") while the coach thinks, and that talk mustn't cancel it.
// When a prepped person turns up mid-chat (name caught or tapped), the coach tells you who they are.
import type { Person, Speaker, Utterance } from "@larp/shared";
import { llmAvailable, streamText } from "../../lib/llm";
import type { LiveContext, LiveListener } from "./session";
import { buildSystem, linesSinceMe, nudgePrompt, parseReply, stallPrompt, turnPrompt, unfinishedPrompt } from "./hintPrompt";

const STALL_MS = 7000;
/** Back-to-back whispers talk over each other; this keeps at most one per window. */
const COOLDOWN_MS = 4000;
/** A hint later than this is useless anyway, and must not hold up saving the conversation. */
const LLM_TIMEOUT_MS = 5000;
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
  /** The line still being spoken, how many of its questions were seen, and whether one was hinted early. */
  partial: string;
  questionsSeen: number;
  hintedEarly: boolean;
  questionTimer?: NodeJS.Timeout;
  lastHintAt: number;
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
      hintedEarly: false,
      lastHintAt: 0,
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
    // The finished line replaces the in-progress one; its questions are hinted below unless one already was.
    clearTimeout(st.questionTimer);
    const alreadyHinted = st.hintedEarly;
    st.partial = "";
    st.questionsSeen = 0;
    st.hintedEarly = false;
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
    const joinIn = leftOut(ctx, st);
    const urgent = !alreadyHinted && countQuestions(u.text) > 0;
    const reply = await askHint(ctx, st, turnPrompt(ctx.conversation.transcript, ctx.conversation.hints, { joinIn }), urgent);
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
    const reply = await askHint(ctx, st, nudgePrompt(ctx.conversation.transcript, ctx.conversation.hints), true);
    if (reply.hint) return; // askHint already whispered it
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
  st.hintedEarly = true;
  try {
    await askHint(ctx, st, unfinishedPrompt(ctx.conversation.transcript, ctx.conversation.hints, st.partial), true);
  } catch (e) {
    console.error("[live:hints] question", e); // timer callback: nothing upstream to catch it
  }
}

/** Asks for a hint and whispers it, unless a hint from a newer request already went out. `urgent` (a question) skips the cooldown. */
async function askHint(ctx: LiveContext, st: HintState, prompt: string, urgent: boolean): Promise<ReturnType<typeof parseReply>> {
  const req = ++st.req;
  const reply = parseReply(await ask(ctx, prompt));
  if (reply.hint && req > st.spokenReq && claim(st, urgent)) {
    st.spokenReq = req;
    await ctx.whisper(reply.hint);
  }
  return reply;
}

/** Claims the nudge window when true, so lines arriving close together can't each ask for one. */
function leftOut(ctx: LiveContext, st: HintState): boolean {
  if (linesSinceMe(ctx.conversation.transcript) < JOIN_AFTER_LINES || Date.now() - st.lastJoinAt < JOIN_EVERY_MS) return false;
  st.lastJoinAt = Date.now();
  return true;
}

async function stallHint(ctx: LiveContext, seq: number): Promise<void> {
  const st = stateOf(ctx);
  if (st.seq !== seq || ctx.conversation.endedAt) return;
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
  if (claim(st, urgent)) await ctx.whisper(text);
}

/** Takes the whisper slot. `urgent` skips the cooldown: a question to answer, or who just walked up, beats any other hint. */
function claim(st: HintState, urgent: boolean): boolean {
  if (!urgent && Date.now() - st.lastHintAt < COOLDOWN_MS) return false;
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
