// Hints listener with a scripted LLM: speaker inference, whispering, which hints survive, early question hints.
import type { ServerMsg } from "@larp/shared";
import { beforeEach, expect, test, vi } from "vitest";
import { seedDemo } from "../src/lib/seed";
import { nudgePrompt, parseReply } from "../src/modules/live/hintPrompt";
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

test("a question gets its hint soon after another hint, once that whisper has played", async () => {
  llm.replies.push({ text: "them\nThat sounds fun, where do you climb?", delayMs: 0 }, { text: "them\nYeah, Squamish twice a year", delayMs: 0 });
  const { s, hints } = await session();
  await s.handle({ type: "say", speaker: "unknown", text: "I'm into climbing." });
  await vi.waitFor(() => expect(hints()).toHaveLength(1));
  vi.useFakeTimers({ now: Date.now() + 5000, toFake: ["Date"] }); // the first whisper has finished playing, cooldown hasn't
  await s.handle({ type: "say", speaker: "unknown", text: "Have you been to Squamish?" });
  await s.stop();
  vi.useRealTimers();
  expect(hints()).toEqual(["That sounds fun, where do you climb?", "Yeah, Squamish twice a year"]);
});

test("a question mid-line is answered as soon as the line is final, with no second call", async () => {
  llm.replies.push({ text: "them\nHonestly I think it'll cut model prices", delayMs: 0 }, { text: "them\nsecond take", delayMs: 0 });
  const { s, hints } = await session();
  hintsListener.onPartial!(s, "Did you hear about the IPO?", "unknown");
  await vi.waitFor(() => expect(llm.prompts).toHaveLength(1));
  expect(llm.prompts[0]).toContain("still being spoken");
  expect(hints()).toEqual([]); // not spoken off a partial
  await s.handle({ type: "say", speaker: "unknown", text: "Did you hear about the IPO? Um, yeah." });
  await s.stop();
  expect(hints()).toEqual(["Honestly I think it'll cut model prices"]);
  expect(llm.prompts).toHaveLength(1);
  expect(s.conversation.transcript[0].speaker).toBe("them");
});

test("an answer to a misheard partial is dropped when the final line asks something else (prod: 'Just a hoodie')", async () => {
  llm.replies.push({ text: "them\nJust a hoodie, hackathon uniform", delayMs: 0 }, { text: "them\nA coach for networking events", delayMs: 0 });
  const { s, hints } = await session();
  hintsListener.onPartial!(s, "Do you know what I'm wearing?", "unknown");
  await vi.waitFor(() => expect(llm.prompts).toHaveLength(1));
  await s.handle({ type: "say", speaker: "unknown", text: "Do you know what I'm working on?" });
  await s.stop();
  expect(hints()).toEqual(["A coach for networking events"]);
});

test("an answer fetched for the user's own question is never spoken", async () => {
  llm.replies.push({ text: "them\nNorth of a hundred billion", delayMs: 0 });
  const { s, hints } = await session();
  hintsListener.onPartial!(s, "No, I haven't. Do you know?", "unknown");
  await vi.waitFor(() => expect(llm.prompts).toHaveLength(1));
  await s.handle({ type: "say", speaker: "me", text: "No, I haven't. Do you know?" });
  await s.stop();
  expect(hints()).toEqual([]);
});

test("the coach stays quiet when it judges the user asked the question (prod: it answered 'Teaching what?')", async () => {
  llm.replies.push({ text: "me\nI teach robotics basics, mostly to kids", delayMs: 0 }, { text: "me\nRight now I'm building clinical AI", delayMs: 0 });
  const { s, hints } = await session();
  hintsListener.onPartial!(s, "Teaching. Teaching what?", "unknown");
  await vi.waitFor(() => expect(llm.prompts).toHaveLength(1));
  await s.handle({ type: "say", speaker: "unknown", text: "So what are you up to right now?" });
  await s.stop();
  expect(hints()).toEqual([]);
  expect(s.conversation.transcript[0].speaker).toBe("me");
});

test("a question doesn't cut off a whisper still playing", async () => {
  llm.replies.push({ text: "them\nThat sounds fun, where do you climb?", delayMs: 0 }, { text: "them\nYeah, Squamish twice a year", delayMs: 0 });
  const { s, hints } = await session();
  await s.handle({ type: "say", speaker: "unknown", text: "I'm into climbing." });
  await vi.waitFor(() => expect(hints()).toHaveLength(1));
  await s.handle({ type: "say", speaker: "unknown", text: "Have you been to Squamish?" });
  await s.stop();
  expect(hints()).toHaveLength(1);
});

test("reading a hint aloud doesn't trigger an early answer to its question", async () => {
  const { s, hints } = await session();
  s.conversation.hints.push({ id: "h", text: "Nice, what kind of robots do you build?", at: Date.now() - 8000 });
  hintsListener.onPartial!(s, "Nice, what kind of robots do you build?", "unknown");
  await new Promise((r) => setTimeout(r, 300));
  await s.stop();
  expect(llm.prompts).toHaveLength(0);
  expect(hints()).toEqual([]);
});

test("a hint that arrives after the user already spoke is dropped", async () => {
  llm.replies.push({ text: "them\nSay you love the dental angle", delayMs: 150 });
  const { s, hints } = await session();
  const pending = s.handle({ type: "say", speaker: "them", text: "We do voice agents for dentists." });
  await new Promise((r) => setTimeout(r, 20));
  await s.handle({ type: "say", speaker: "me", text: "Oh nice, for which clinics?" });
  await pending;
  await s.stop();
  expect(hints()).toEqual([]);
});

test("1:1 with no lines from the user yet: no 'way in' nudge", async () => {
  const { s } = await session();
  for (const text of ["Hey.", "So what brings you here?", "I'm Jinay by the way.", "Are you hacking tonight?"]) {
    await s.handle({ type: "say", speaker: "them", text });
  }
  await s.stop();
  expect(llm.prompts.some((p) => p.includes("a way in"))).toBe(false);
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

test("sharing filler words with a hint isn't saying it (prod: the other person's 'I'm working on building robots')", () => {
  const hints = [{ id: "h", text: "You were saying you're working on something, Junaid? Jinay, what about you?", at: 0 }];
  expect(repeatsHint("I'm working on building robots.", hints, 8000)).toBe(false);
  expect(repeatsHint("I'm working on robot, robot", hints, 8000)).toBe(false);
});

test("short real read-backs still count (near-verbatim, or sharing the hint's distinctive words)", () => {
  const at = (text: string) => [{ id: "h", text, at: 0 }];
  expect(repeatsHint("What are you working on, Junaid?", at("What are you working on, Jinay?"), 8000)).toBe(true);
  expect(repeatsHint("So what are you up to right now?", at("So what are you up to right now?"), 8000)).toBe(true);
  expect(repeatsHint("What robots do you build?", at("What robots do you build, and for who?"), 8000)).toBe(true);
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
  await s.handle({ type: "add_participant", personId: "p-priya" });
  await s.handle({ type: "say", speaker: "me", text: "Hey all, good to see you." });
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
  for (const [speaker, text] of [["them", "I went to Waterloo."], ["them", "Then I joined a startup."], ["me", "Totally"], ["them", "Now I build robots."]] as const) {
    await s.handle({ type: "say", speaker, text });
    await new Promise((r) => setTimeout(r, 20));
  }
  await vi.waitFor(() => expect(llm.prompts).toHaveLength(3)); // no LLM call for your own line
  expect(llm.prompts.some((p) => p.includes("a way in"))).toBe(false);
});

test("a nudge always whispers, even right after a hint and when the coach thinks the user spoke", async () => {
  llm.replies.push({ text: "them\nWhere do you climb?", delayMs: 0 }, { text: "me\nSquamish, mostly bouldering", delayMs: 0 });
  const { s, hints } = await session();
  await s.handle({ type: "say", speaker: "unknown", text: "I'm into climbing." });
  await vi.waitFor(() => expect(hints()).toHaveLength(1));
  await s.handle({ type: "nudge" });
  await vi.waitFor(() => expect(hints()).toEqual(["Where do you climb?", "Squamish, mostly bouldering"]));
  await s.stop();
});

test("a nudge assumes only the latest unlabeled line is them; earlier ones may be the user's", async () => {
  const { s } = await session();
  const t = s.conversation.transcript;
  t.push({ speaker: "unknown", text: "I work on earpieces.", at: 1 }, { speaker: "unknown", text: "What's the hard part?", at: 2 });
  await s.handle({ type: "nudge" });
  expect(t.map((u) => u.speaker)).toEqual(["unknown", "them"]);
  await s.stop();
});

test("nudges within 1.5s of each other are one ask", async () => {
  llm.replies.push({ text: "them\nFirst answer", delayMs: 0 }, { text: "them\nSecond answer", delayMs: 0 });
  const { s, hints } = await session();
  const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  await s.handle({ type: "nudge" });
  now.mockReturnValue(1_001_000); // 1s later: same ask
  await s.handle({ type: "nudge" });
  now.mockReturnValue(1_002_000); // 2s after the first: a new ask
  await s.handle({ type: "nudge" });
  now.mockRestore();
  expect(llm.prompts).toHaveLength(2);
  expect(hints()).toEqual(["First answer", "Second answer"]);
  await s.stop();
});

test("the nudge prompt always answers, plays it up, and keeps it short", () => {
  const p = nudgePrompt([{ speaker: "them", text: "What's your take on RAG?", at: 1 }], []);
  expect(p).toContain("never -");
  expect(p).toContain("at most 12 words");
  expect(p).toMatch(/sound impressive/i);
  expect(p).not.toMatch(/never invent/i);
});

test("a short reaction after an answered question doesn't get a second answer (prod: 'Interesting.')", async () => {
  llm.replies.push({ text: "them\nYeah, I fused LiDAR and camera for a robotics team", delayMs: 0 });
  const { s, hints } = await session();
  await s.handle({ type: "say", speaker: "them", text: "Do you know anything about perception?" });
  await vi.waitFor(() => expect(hints()).toHaveLength(1));
  vi.useFakeTimers({ now: Date.now() + 8000, toFake: ["Date"] });
  await s.handle({ type: "say", speaker: "them", text: "Interesting." });
  await s.stop();
  vi.useRealTimers();
  expect(hints()).toHaveLength(1);
  expect(llm.prompts).toHaveLength(1);
});
