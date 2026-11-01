// Hints listener with a scripted LLM: speaker inference, whispering, stale-hint dropping.
import type { ServerMsg } from "@larp/shared";
import { beforeEach, expect, test, vi } from "vitest";
import { seedDemo } from "../src/lib/seed";
import { parseReply } from "../src/modules/live/hintPrompt";
import { hintsListener } from "../src/modules/live/hints";
import { isEchoOfHint, LiveSession } from "../src/modules/live/session";

const llm = vi.hoisted(() => ({ replies: [] as { text: string; delayMs: number }[], prompts: [] as string[] }));
vi.mock("../src/lib/llm", () => ({
  llmAvailable: true,
  async *streamText(ask: { prompt: string }) {
    llm.prompts.push(ask.prompt);
    const { text, delayMs } = llm.replies.shift() ?? { text: "them\n-", delayMs: 0 };
    await new Promise((r) => setTimeout(r, delayMs));
    yield text;
  },
}));

beforeEach(() => void ((llm.replies = []), (llm.prompts = [])));

async function session() {
  await seedDemo("test-hints");
  const sent: ServerMsg[] = [];
  const s = new LiveSession("test-hints", { json: (m) => sent.push(m), binary: () => {} }, [hintsListener]);
  await s.handle({ type: "start", personId: "p-sam" });
  return { s, hints: () => sent.flatMap((m) => (m.type === "hint" ? [m.text] : [])) };
}

test("mic line of unknown speaker gets relabeled and hinted", async () => {
  llm.replies.push({ text: "them\nMention your Larp Coach demo", delayMs: 0 });
  const { s, hints } = await session();
  await s.handle({ type: "say", speaker: "unknown", text: "So what are you working on?" });
  await s.stop();
  expect(s.conversation.transcript[0].speaker).toBe("them");
  expect(hints()).toEqual(["Mention your Larp Coach demo"]);
});

test("your own lines never trigger a hint", async () => {
  const { s, hints } = await session();
  await s.handle({ type: "say", speaker: "me", text: "What are you building?" });
  await s.stop();
  expect(hints()).toEqual([]);
});

test("a hint is dropped if the conversation moved on before it was ready", async () => {
  llm.replies.push({ text: "them\nslow stale hint", delayMs: 50 }, { text: "me\n-", delayMs: 0 });
  const { s, hints } = await session();
  await s.handle({ type: "say", speaker: "unknown", text: "What do you do?" });
  await s.handle({ type: "say", speaker: "unknown", text: "I build earpieces." });
  await s.stop();
  expect(hints()).toEqual([]);
  expect(s.conversation.transcript.map((u) => u.speaker)).toEqual(["them", "me"]);
});

test("parseReply tolerates model noise", () => {
  expect(parseReply("them\nAsk about their tennis app")).toEqual({ speaker: "them", hint: "Ask about their tennis app" });
  expect(parseReply("Me.\n-")).toEqual({ speaker: "me", hint: undefined });
  expect(parseReply(' none \n "Ask what got them into robotics" ')).toEqual({
    speaker: undefined,
    hint: "Ask what got them into robotics",
  });
});

test("mic lines that echo a recent whisper are dropped, real speech is kept", () => {
  const hints = [{ id: "h", text: "Mention your Larp Coach demo", at: 1000 }];
  expect(isEchoOfHint("mention your Larp coach demo.", hints, 3000)).toBe(true);
  expect(isEchoOfHint("Do you have a demo I can see?", hints, 3000)).toBe(false);
  expect(isEchoOfHint("mention your Larp coach demo", hints, 20000)).toBe(false); // too long ago
});

test("left out of a group chat: after 3 lines from others, the coach offers a way in, then waits", async () => {
  const { s, hints } = await session();
  const others = ["So who's going to the afterparty?", "Depends if the DJ is any good", "Last year's was all techno", "Techno at a hackathon is wild"];
  llm.replies.push({ text: "them\n-", delayMs: 0 }, { text: "them\n-", delayMs: 0 }, { text: "them\nAsk what music they'd pick instead", delayMs: 0 });
  for (const [i, text] of others.entries()) {
    await s.handle({ type: "say", speaker: "them", text });
    await vi.waitFor(() => expect(llm.prompts).toHaveLength(i + 1)); // real speech arrives seconds apart
  }
  expect(llm.prompts.map((p) => p.includes("a way in"))).toEqual([false, false, true, false]); // nudged once, then holds off
  await vi.waitFor(() => expect(hints()).toContain("Ask what music they'd pick instead"));
});

test("speaking resets the left-out count", async () => {
  const { s } = await session();
  for (const [speaker, text] of [["them", "One"], ["them", "Two"], ["me", "Totally"], ["them", "Three"]] as const) {
    await s.handle({ type: "say", speaker, text });
    await new Promise((r) => setTimeout(r, 20));
  }
  await vi.waitFor(() => expect(llm.prompts).toHaveLength(3)); // no LLM call for your own line
  expect(llm.prompts.some((p) => p.includes("a way in"))).toBe(false);
});
