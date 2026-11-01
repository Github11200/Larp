// Chunk 1 · Decides when to whisper and what. The core demo moment.
// One fast LLM call per line does two jobs: works out who said it (the mic can't tell),
// and decides whether a hint helps. A few quiet seconds also earns a hint to restart the chat.
import type { Speaker, Utterance } from "@larp/shared";
import { llmAvailable, streamText } from "../../lib/llm";
import type { LiveContext, LiveListener } from "./session";
import { buildSystem, parseReply, stallPrompt, turnPrompt } from "./hintPrompt";

const STALL_MS = 7000;
/** Back-to-back whispers talk over each other; this keeps at most one per window. */
const COOLDOWN_MS = 4000;

interface HintState {
  /** Bumped on every line; a hint whose line has been followed by another is stale and dropped. */
  seq: number;
  lastHintAt: number;
  stallTimer?: NodeJS.Timeout;
}
const states = new WeakMap<LiveContext, HintState>();
const stateOf = (ctx: LiveContext) => states.get(ctx) ?? states.set(ctx, { seq: 0, lastHintAt: 0 }).get(ctx)!;

export const hintsListener: LiveListener = {
  name: "hints",
  onPartial(ctx) {
    clearTimeout(stateOf(ctx).stallTimer); // someone is talking, so no stall
  },
  async onUtterance(ctx, u) {
    const st = stateOf(ctx);
    const seq = ++st.seq;
    clearTimeout(st.stallTimer);
    st.stallTimer = setTimeout(() => void stallHint(ctx, seq), STALL_MS);
    st.stallTimer.unref();

    if (!llmAvailable) return stubHint(ctx, u);
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
      : stubOpener(ctx);
    if (hint && st.seq === seq) await whisper(ctx, st, hint);
  } catch (e) {
    console.error("[live:hints] stall", e); // timer callback: nothing upstream to catch it
  }
}

async function ask(ctx: LiveContext, prompt: string): Promise<string> {
  const t0 = Date.now();
  let text = "";
  for await (const delta of streamText({ model: "fast", system: buildSystem(ctx), prompt, maxTokens: 40 })) text += delta;
  console.log(`[live:hints] llm ${Date.now() - t0}ms -> ${JSON.stringify(text)}`);
  return text;
}

async function whisper(ctx: LiveContext, st: HintState, text: string): Promise<void> {
  if (Date.now() - st.lastHintAt < COOLDOWN_MS) return;
  st.lastHintAt = Date.now();
  await ctx.whisper(text);
}

/** No LLM: answer their questions with a dossier opener. */
async function stubHint(ctx: LiveContext, u: Utterance): Promise<void> {
  if (!isThem(u.speaker) || !u.text.trim().endsWith("?")) return;
  await ctx.whisper(stubOpener(ctx));
}

function stubOpener(ctx: LiveContext): string {
  const opener = ctx.person?.dossier?.openers[0];
  return opener ? `Then ask: ${opener}` : "Answer, then ask what they're building";
}

const isThem = (s: Speaker) => s !== "me";
