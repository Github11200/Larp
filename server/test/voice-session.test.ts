// Mic lines carry voiceprints: once the user is heard saying a hint, their voice labels later lines without the LLM.
import type { ServerMsg, Voice } from "@larp/shared";
import { expect, test, vi } from "vitest";
import { seedDemo } from "../src/lib/seed";
import { hintsListener } from "../src/modules/live/hints";
import { LiveSession } from "../src/modules/live/session";
import type { SttEvents } from "../src/modules/live/stt";

const mic = vi.hoisted(() => ({ events: null as SttEvents | null }));
vi.mock("../src/modules/live/stt", () => ({
  sttAvailable: true,
  openStt(events: SttEvents) {
    mic.events = events;
    return { write() {}, close() {} };
  },
}));
const llm = vi.hoisted(() => ({ replies: [] as string[], calls: 0 }));
vi.mock("../src/lib/llm", () => ({
  llmAvailable: true,
  async *streamText() {
    llm.calls++;
    yield llm.replies.shift() ?? "them\n-";
  },
}));

const ME: Voice = { db: -20, pitchHz: 120 };
const OTHER: Voice = { db: -24, pitchHz: 210 };

test("after the user says a hint aloud, their voice is recognized; other voices are them", async () => {
  await seedDemo("test-voice");
  const sent: ServerMsg[] = [];
  const s = new LiveSession("test-voice", { json: (m) => sent.push(m), binary: () => {} }, [hintsListener]);
  await s.handle({ type: "start" });
  const say = async (text: string, voice: Voice) => {
    mic.events!.onCommit(text, "unknown", voice);
    await new Promise((r) => setTimeout(r, 20));
  };

  llm.replies.push("them\nHey, I'm Nonit, I build AI tools for doctors. What about you?");
  await say("Hey, nice to meet you.", OTHER);
  await vi.waitFor(() => expect(sent.some((m) => m.type === "hint")).toBe(true));
  vi.useFakeTimers({ now: Date.now() + 8000, toFake: ["Date"] }); // past the echo window
  await say("Hey, I'm Nonit, I build AI tools for doctors. What about you?", ME);
  await say("Yeah so I mostly work on the backend side.", { db: -21, pitchHz: 126 });
  await say("Oh cool, what stack do you use?", OTHER);
  vi.useRealTimers();
  await s.stop();

  expect(s.conversation.transcript.map((u) => u.speaker)).toEqual(["them", "me", "me", "them"]);
  expect(s.conversation.transcript[1].voice).toEqual(ME); // saved, for tuning from real tests
  expect(llm.calls).toBe(2); // the user's own lines never ask the LLM
});
