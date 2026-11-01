// Live mode beyond "I prepped this one person": strangers, names caught from speech, groups,
// reconnects that keep the same conversation, and saving that never waits on a stuck call.
import { demoPeople, demoProfile, type ServerMsg } from "@larp/shared";
import { expect, test, vi } from "vitest";
import { db } from "../src/lib/db";
import { seedDemo } from "../src/lib/seed";
import { listeners } from "../src/listeners";
import { hintsListener } from "../src/modules/live/hints";
import { catchNames, soundsAlike } from "../src/modules/live/names";
import { LiveSession, sessionFor, STOP_WAIT_MS, type LiveListener, type Transport } from "../src/modules/live/session";

vi.mock("../src/lib/llm", () => ({ llmAvailable: false, async *streamText() {} }));
// Each whisper streams 3 slow audio frames tagged with its text, so overlap is visible.
vi.mock("../src/modules/live/tts", () => ({
  async *synthesize(text: string) {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 10));
      yield new TextEncoder().encode(text);
    }
  },
}));

let n = 0;
async function newUser() {
  const userId = `test-people-${n++}`;
  await seedDemo(userId);
  return userId;
}

function recorder() {
  const sent: (ServerMsg | { type: "audio"; text: string })[] = [];
  const transport: Transport = {
    json: (m) => sent.push(m),
    binary: (c) => sent.push({ type: "audio", text: new TextDecoder().decode(c) }),
  };
  const of = <T extends ServerMsg["type"]>(type: T) => sent.filter((m): m is Extract<ServerMsg, { type: T }> => m.type === type);
  return { sent, transport, of };
}

test("catchNames: intros, friends, greetings; fuzzy attendee match; skips non-names and yourself", () => {
  const names = (text: string) => catchNames(text, demoPeople, ["Alex Rivera", "Larp Coach"]).map((c) => `${c.name}${c.person ? "*" : ""}`);
  expect(names("Hi, I'm Mati")).toEqual(["Mati"]);
  expect(names("and this is my friend Sara")).toEqual(["Sara"]);
  expect(names("hey priya, good to see you")).toEqual(["Priya Patel*"]); // lowercase ok when it's an attendee
  expect(names("Hey Pria!")).toEqual(["Priya Patel*"]); // STT spelling
  expect(names("Nice to meet you, Sam. I'm Dana Kim")).toEqual(["Sam Chen*", "Dana Kim"]);
  expect(names("I'm good, this is great, hey everyone")).toEqual([]);
  expect(names("I'm Alex and this is Larp")).toEqual([]);
  expect(names("i'm working on something new")).toEqual([]);
});

test("catchNames: bare greetings only catch attendees; a mixed line still catches the other person's intro", () => {
  const names = (text: string) => catchNames(text, demoPeople, ["Alex Rivera", "Nonit"]).map((c) => c.name);
  expect(names("Hey Siri, thanks Google")).toEqual([]);
  expect(names("hey priya")).toEqual(["Priya Patel"]);
  expect(names("Nice to meet you, Quinn")).toEqual(["Quinn"]);
  expect(names("Hey, I'm Nonit. What's your name? I'm Junaid.")).toEqual(["Junaid"]);
});

test("soundsAlike: a misheard name isn't a new person; real different names are", () => {
  expect(soundsAlike("Junaid", "Jinay")).toBe(true);
  expect(soundsAlike("Jinae", "Jinay")).toBe(true);
  for (const other of ["John", "Jim", "Jamie"]) expect(soundsAlike(other, "Jinay")).toBe(false);
  expect(soundsAlike("Juan", "Jinay")).toBe(true); // accepted cost: spelled as close as Junaid; tap to add them instead
  for (const other of ["Sean", "Simon", "Sara"]) expect(soundsAlike(other, "Sam")).toBe(false);
  expect(soundsAlike("Ryan", "Ron")).toBe(false);
  expect(soundsAlike("Lena", "Mati")).toBe(false);
});

test("a stranger whose name sounds like someone already here isn't added twice", async () => {
  const userId = await newUser();
  const r = recorder();
  const s = new LiveSession(userId, r.transport, listeners);
  await s.handle({ type: "start" });
  await s.handle({ type: "say", speaker: "them", text: "Hi, I'm Jinay." });
  await s.handle({ type: "say", speaker: "them", text: "Yeah, I'm Junaid, nice to meet you." });
  await s.stop();
  expect(s.conversation.participants).toEqual([{ name: "Jinay" }]);
});

test("1:1 with a stranger: a caught name becomes a participant; general openers until then", async () => {
  const userId = await newUser();
  const r = recorder();
  const s = new LiveSession(userId, r.transport, listeners);
  await s.handle({ type: "start" });
  expect(r.of("ready")[0]).toMatchObject({ eventId: "evt-demo", ears: false });
  expect(r.of("openers")[0].lines.join(" ")).toMatch(/what's yours\?/);

  await s.handle({ type: "say", speaker: "them", text: "Hey! I'm Mati, what's your name?" });
  await s.stop();
  expect(r.of("participants").at(-1)?.participants).toEqual([{ name: "Mati" }]);

  const saved = await db.conversations.get(userId, s.conversation.id);
  expect(saved).toMatchObject({ eventId: "evt-demo", participants: [{ name: "Mati" }] });
  expect(saved?.personId).toBeUndefined();
});

test("going live from an older event's screen uses that event, not the newest", async () => {
  const userId = await newUser();
  await db.events.put(userId, { id: "evt-newer", name: "Newer", status: "ready", createdAt: Date.now() + 1000 });
  const r = recorder();
  const s = new LiveSession(userId, r.transport, listeners);
  await s.handle({ type: "start", eventId: "evt-demo" });
  expect(r.of("ready")[0]).toMatchObject({ eventId: "evt-demo" });
});

test("a caught name that matches an attendee attaches their dossier and whispers who they are", async () => {
  const userId = await newUser();
  const r = recorder();
  const s = new LiveSession(userId, r.transport, [hintsListener]);
  await s.handle({ type: "start" });
  await s.handle({ type: "say", speaker: "unknown", text: "Oh hi, I'm Priya." });
  await s.stop();
  expect(s.person?.id).toBe("p-priya");
  expect(s.conversation.participants).toEqual([{ name: "Priya Patel", personId: "p-priya" }]);
  expect(r.of("hint").map((h) => h.text)).toEqual(["That's Priya. Ask about LLM evals"]);
  expect(r.of("openers").at(-1)?.lines[0]).toBe("How do you evaluate LLM features before shipping?");
});

test("a prepped person who asks something as they introduce themselves gets an answer, not 'That's X'", async () => {
  const userId = await newUser();
  const r = recorder();
  const s = new LiveSession(userId, r.transport, [hintsListener]);
  await s.handle({ type: "start" });
  await s.handle({ type: "say", speaker: "unknown", text: "Oh hi, I'm Priya. What are you building?" });
  await s.stop();
  expect(s.person?.id).toBe("p-priya");
  expect(r.of("hint").map((h) => h.text)).not.toContain("That's Priya. Ask about LLM evals");
});

test("group: tapped people, a caught stranger, primary stays the first prepped person", async () => {
  const userId = await newUser();
  const r = recorder();
  const s = new LiveSession(userId, r.transport, listeners);
  await s.handle({ type: "start", personId: "p-sam" });
  await s.handle({ type: "add_participant", personId: "p-priya" });
  await s.handle({ type: "set_person", personId: "nope" }); // bad id must not drop Sam
  await s.handle({ type: "say", speaker: "them", text: "This is my cofounder Lena." });
  await s.handle({ type: "remove_participant", personId: "p-sam" });
  await s.handle({ type: "add_participant", personId: "p-sam" });
  await s.stop();

  expect(r.of("error")).toHaveLength(1);
  const saved = await db.conversations.get(userId, s.conversation.id);
  expect(saved?.participants.map((p) => p.name)).toEqual(["Priya Patel", "Lena", "Sam Chen"]);
  expect(saved?.personId).toBe("p-priya"); // Sam left, so Priya took over as primary
  expect(saved?.eventId).toBe("evt-demo");
});

test("reconnect resumes the same conversation (in memory), and replays it to the new socket", async () => {
  const userId = await newUser();
  const a = recorder();
  const s = sessionFor(userId, a.transport, listeners);
  await s.handle({ type: "start", personId: "p-sam" });
  await s.handle({ type: "say", speaker: "them", text: "What are you working on?" });
  s.detach(a.transport); // page refresh

  const b = recorder();
  const again = sessionFor(userId, b.transport, listeners, s.conversation.id);
  expect(again).toBe(s);
  await again.handle({ type: "start", conversationId: s.conversation.id });
  expect(b.of("ready")[0]).toMatchObject({ conversationId: s.conversation.id, resumed: true });
  expect(b.of("transcript").map((t) => t.text)).toEqual(["What are you working on?"]);

  await again.handle({ type: "say", speaker: "me", text: "An earpiece coach." });
  await again.stop();
  const all = await db.conversations.list(userId);
  expect(all).toHaveLength(1);
  expect(all[0].transcript).toHaveLength(2);
});

test("resume after the conversation was already saved (server restart) continues it under the same id", async () => {
  const userId = await newUser();
  const first = new LiveSession(userId, recorder().transport, []);
  await first.handle({ type: "start" });
  await first.handle({ type: "add_participant", name: "Mati" });
  await first.handle({ type: "say", speaker: "them", text: "Line one" });
  await first.stop();

  const r = recorder();
  const second = sessionFor(userId, r.transport, [], first.conversation.id);
  expect(second).not.toBe(first);
  await second.handle({ type: "start", conversationId: first.conversation.id });
  await second.handle({ type: "say", speaker: "them", text: "Line two" });
  await second.stop();
  const all = await db.conversations.list(userId);
  expect(all).toHaveLength(1);
  expect(all[0]).toMatchObject({ participants: [{ name: "Mati" }] });
  expect(all[0].transcript.map((u) => u.text)).toEqual(["Line one", "Line two"]);
});

test("each finished line is snapshotted, so a restart mid-chat loses nothing", async () => {
  const userId = await newUser();
  const s = new LiveSession(userId, recorder().transport, []);
  await s.handle({ type: "start" });
  await s.handle({ type: "say", speaker: "them", text: "still here?" });
  await new Promise((r) => setTimeout(r, 10));
  const snap = await db.conversations.get(userId, s.conversation.id);
  expect(snap?.transcript.map((u) => u.text)).toEqual(["still here?"]);
  expect(snap?.endedAt).toBeUndefined();
  await s.stop();
  expect((await db.conversations.get(userId, s.conversation.id))?.endedAt).toBeTypeOf("number");
});

test("stop saves within the cap even if a listener hangs forever", async () => {
  const userId = await newUser();
  const stuck: LiveListener = { name: "stuck", onUtterance: () => new Promise(() => {}) };
  const s = new LiveSession(userId, recorder().transport, [stuck]);
  await s.handle({ type: "start" });
  await s.handle({ type: "say", speaker: "them", text: "hello?" });
  const t0 = Date.now();
  await s.stop();
  expect(Date.now() - t0).toBeLessThan(STOP_WAIT_MS + 500);
  expect(await db.conversations.get(userId, s.conversation.id)).toBeTruthy();
});

test("a newer whisper silences the older one: no old audio after the new hint", async () => {
  const userId = await newUser();
  const r = recorder();
  const s = new LiveSession(userId, r.transport, []);
  await s.handle({ type: "start" });
  const first = s.whisper("old");
  await new Promise((resolve) => setTimeout(resolve, 15)); // old is mid-stream
  await Promise.all([first, s.whisper("new")]);
  const newHintAt = r.sent.findIndex((m) => m.type === "hint" && m.text === "new");
  const oldAudioAfter = r.sent.slice(newHintAt).filter((m) => m.type === "audio" && m.text === "old");
  expect(oldAudioAfter).toEqual([]);
  expect(r.sent.filter((m) => m.type === "audio" && m.text === "new")).toHaveLength(3);
});

test("misheard names in the transcript snap to me and the event's attendees", async () => {
  const userId = await newUser();
  await db.profiles.put(userId, { ...demoProfile, name: "Nonit Gupta" });
  await db.people.put(userId, { ...demoPeople[0], id: "p-jinay", name: "Jinay Shah" });
  const r = recorder();
  const s = new LiveSession(userId, r.transport, listeners);
  await s.handle({ type: "start" });
  await s.handle({ type: "say", speaker: "unknown", text: "Hi, I'm No nit, and this is my friend Janae." });
  await s.stop();
  expect(r.of("transcript")[0].text).toBe("Hi, I'm Nonit, and this is my friend Jinay.");
  expect(s.conversation.transcript[0].text).toBe("Hi, I'm Nonit, and this is my friend Jinay.");
  expect(s.conversation.participants.map((p) => p.name)).toEqual(["Jinay Shah"]); // not a stranger called "No"
});
