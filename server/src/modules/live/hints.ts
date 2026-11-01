// Chunk 1 · Decides when to whisper and what. The core demo moment.
// One fast LLM call per line does two jobs: works out who said it (the mic can't tell),
// and decides whether a hint helps. A few quiet seconds also earns a hint to restart the chat.
// When a prepped person turns up mid-chat (name caught or tapped), the coach tells you who they are.
import type { Person, Speaker, Utterance } from "@larp/shared";
import { llmAvailable, streamText } from "../../lib/llm";
import type { LiveContext, LiveListener } from "./session";
import { buildSystem, parseReply, stallPrompt, turnPrompt } from "./hintPrompt";

const STALL_MS = 7000;
/** Back-to-back whispers talk over each other; this keeps at most one per window. */
const COOLDOWN_MS = 4000;
/** A hint later than this is useless anyway, and must not hold up saving the conversation. */
const LLM_TIMEOUT_MS = 5000;

interface HintState {
  /** Bumped on every line; a hint whose line has been followed by another is stale and dropped. */
  seq: number;
  lastHintAt: number;
  stallTimer?: NodeJS.Timeout;
  /** Prepped people already introduced (or there from the start), so each gets one "that's X" whisper. */
  introduced: Set<string>;
  /** Stub mode cycles through openers instead of repeating the first. */
  stubTurn: number;
}
const states = new WeakMap<LiveContext, HintState>();
const stateOf = (ctx: LiveContext) =>
  states.get(ctx) ??
  states.set(ctx, { seq: 0, lastHintAt: 0, introduced: new Set(ctx.people.map((p) => p.id)), stubTurn: 0 }).get(ctx)!;

export const hintsListener: LiveListener = {
  name: "hints",
  onPartial(ctx) {
    clearTimeout(stateOf(ctx).stallTimer); // someone is talking, so no stall
  },
  async onUtterance(ctx, u) {
    const st = stateOf(ctx);
    const seq = ++st.seq;
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
    const reply = parseReply(await ask(ctx, turnPrompt(ctx.conversation.transcript, ctx.conversation.hints)));
    if (u.speaker === "unknown" && reply.speaker) ctx.setSpeaker(u, reply.speaker);
    if (reply.hint && st.seq === seq) await whisper(ctx, st, reply.hint);
  },
  onEnd(ctx) {
    clearTimeout(stateOf(ctx).stallTimer);
  },
};

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
  for await (const delta of streamText({ model: "fast", system: buildSystem(ctx), prompt, maxTokens: 40, signal })) text += delta;
  console.log(`[live:hints] llm ${Date.now() - t0}ms -> ${JSON.stringify(text)}`);
  return text;
}

/** `urgent` skips the cooldown: knowing who just walked up beats any other hint. */
async function whisper(ctx: LiveContext, st: HintState, text: string, urgent = false): Promise<void> {
  if (!urgent && Date.now() - st.lastHintAt < COOLDOWN_MS) return;
  st.lastHintAt = Date.now();
  await ctx.whisper(text);
}

/** "That's Priya. Ask about LLM evals": the dossier, compressed to one breath. */
function intro(p: Person): string {
  const first = p.name.split(" ")[0];
  const topic = p.dossier?.workingOn[0] ?? p.dossier?.commonGround[0];
  return topic ? `That's ${first}. Ask about ${lowerFirst(topic)}` : `That's ${first}. Ask what they're building`;
}

/** No LLM: answer their questions with an opener. */
async function stubHint(ctx: LiveContext, st: HintState, u: Utterance): Promise<void> {
  if (!isThem(u.speaker) || !u.text.trim().endsWith("?")) return;
  await whisper(ctx, st, stubOpener(ctx, st));
}

const GENERAL = ["Answer, then ask what they're building", "Ask what brought them here", "Ask their name, then use it"];

function stubOpener(ctx: LiveContext, st: HintState): string {
  const openers = ctx.people.flatMap((p) => p.dossier?.openers ?? []);
  const i = st.stubTurn++;
  return openers.length ? `Then ask: ${openers[i % openers.length]}` : GENERAL[i % GENERAL.length];
}

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const isThem = (s: Speaker) => s !== "me";
