// Hints listener with a scripted LLM: speaker inference, whispering, which hints survive, early question hints.
import type { ServerMsg } from "@larp/shared";
import { beforeEach, expect, test, vi } from "vitest";
import { seedDemo } from "../src/lib/seed";
import { parseReply } from "../src/modules/live/hintPrompt";
import { hintsListener } from "../src/modules/live/hints";
import { isEchoOfHint, LiveSession, repeatsHint } from "../src/modules/live/session";

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

test("your filler after their question doesn't cancel the hint", async () => {
  llm.replies.push({ text: "them\nI build earpieces that coach you live", delayMs: 50 }, { text: "me\n-", delayMs: 0 });
  const { s, hints } = await session();
  await s.handle({ type: "say", speaker: "unknown", text: "What do you do?" });
  await s.handle({ type: "say", speaker: "unknown", text: "Um, good question." });
  await s.stop();
  expect(hints()).toEqual(["I build earpieces that coach you live"]);
  expect(s.conversation.transcript.map((u) => u.speaker)).toEqual(["them", "me"]);
});

test("an older hint is dropped once a newer line's hint has been spoken", async () => {
  llm.replies.push({ text: "them\nslow stale hint", delayMs: 80 }, { text: "them\nfresh hint", delayMs: 0 });
  const { s, hints } = await session();
  await s.handle({ type: "say", speaker: "unknown", text: "I'm into climbing." });
  await s.handle({ type: "say", speaker: "unknown", text: "Went to Squamish last week." });
  await s.stop();
  expect(hints()).toEqual(["fresh hint"]);
});

test("a question gets its hint even right after another hint", async () => {
  llm.replies.push({ text: "them\nThat sounds fun, where do you climb?", delayMs: 0 }, { text: "them\nYeah, Squamish twice a year", delayMs: 0 });
  const { s, hints } = await session();
  await s.handle({ type: "say", speaker: "unknown", text: "I'm into climbing." });
  await vi.waitFor(() => expect(hints()).toHaveLength(1));
  await s.handle({ type: "say", speaker: "unknown", text: "Have you been to Squamish?" });
  await s.stop();
  expect(hints()).toEqual(["That sounds fun, where do you climb?", "Yeah, Squamish twice a year"]);
});

test("a question mid-line is hinted before the line finishes, and not again when it does", async () => {
  llm.replies.push({ text: "them\nHonestly I think it'll cut model prices", delayMs: 0 }, { text: "them\nsecond take", delayMs: 0 });
  const { s, hints } = await session();
  hintsListener.onPartial!(s, "Did you hear about the IPO?", "unknown");
  await vi.waitFor(() => expect(hints()).toEqual(["Honestly I think it'll cut model prices"]));
  expect(llm.prompts[0]).toContain("still being spoken");
  await s.handle({ type: "say", speaker: "unknown", text: "Did you hear about the IPO? Um, yeah." });
  await s.stop();
  expect(hints()).toEqual(["Honestly I think it'll cut model prices"]); // the finished line is labeled, but the cooldown holds
  expect(llm.prompts).toHaveLength(2);
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

test("a line that repeats a recent hint is the user saying it, even with a misheard name", () => {
  const hints = [{ id: "h", text: "Hey, I'm Nonit — I build AI tools for doctors. What's your name?", at: 0 }];
  expect(repeatsHint("Hey, I'm Anand. I build AI tools for doctors. What's your name?", hints, 8000)).toBe(true);
  expect(repeatsHint("What's your name?", hints, 8000)).toBe(false); // too short to tell
  expect(repeatsHint("I'm building voice agents for dental clinics.", hints, 8000)).toBe(false);
  expect(repeatsHint("Hey, I'm Anand. I build AI tools for doctors.", hints, 60_000)).toBe(false); // too long ago
});

test("saying a hint aloud is credited to you: no hint for it, and no stranger caught from it", async () => {
  llm.replies.push({ text: "them\nHey, I'm Nonit, I build AI tools for doctors. What's your name?", delayMs: 0 });
  const { s, hints } = await session();
  await s.handle({ type: "say", speaker: "unknown", text: "Hello?" });
  await vi.waitFor(() => expect(hints()).toHaveLength(1));
  await new Promise((r) => setTimeout(r, 30));
  vi.useFakeTimers({ now: Date.now() + 8000, toFake: ["Date"] }); // past the echo window
  await s.handle({ type: "say", speaker: "unknown", text: "Hey, I'm Anand. I build AI tools for doctors. What's your name?" });
  vi.useRealTimers();
  await s.stop();
  expect(s.conversation.transcript.map((u) => u.speaker)).toEqual(["them", "me"]);
  expect(s.conversation.participants.map((p) => p.name)).not.toContain("Anand");
  expect(llm.prompts).toHaveLength(1);
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
