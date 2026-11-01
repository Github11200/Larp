// Chunk 5 · Conversations -> notes + follow-ups, with no LLM key (fallback path).
import type { Conversation, Utterance } from "@larp/shared";
import { expect, test } from "vitest";
import { db, newId } from "../src/lib/db";
import { seedDemo } from "../src/lib/seed";
import { promiseFrom } from "../src/modules/followups/fallback";
import { startWriteUp } from "../src/modules/followups/summarize";

const say = (speaker: Utterance["speaker"], text: string): Utterance => ({ speaker, text, at: Date.now() });

/** Saves a conversation like the live session does, ends it, and waits for the write-up job. */
async function talk(userId: string, conv: Partial<Conversation> & { transcript: Utterance[] }) {
  const saved = await db.conversations.put(userId, {
    id: newId(),
    startedAt: Date.now() - 3 * 60000,
    endedAt: Date.now(),
    hints: [],
    linksShared: [],
    participants: [],
    ...conv,
  });
  await startWriteUp(userId, saved);
  for (let i = 0; i < 50; i++) {
    const c = await db.conversations.require(userId, saved.id);
    if (c.notes?.status === "ready") return c;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("write-up never finished");
}

async function freshUser() {
  const userId = `fu-${newId()}`;
  await seedDemo(userId);
  return userId;
}

test("curly apostrophes and 'let me know' are handled", () => {
  expect(promiseFrom("Yeah I’ll intro you to my cofounder!")).toBe("intro them to your cofounder");
  expect(promiseFrom("I'm going to send your team the repo")).toBe("send their team the repo");
  expect(promiseFrom("let me know if you're around")).toBeUndefined();
});

test("nobody named: notes only, no follow-up", async () => {
  const userId = await freshUser();
  const conv = await talk(userId, {
    transcript: [say("unknown", "Hey, I'm Dana, I work on robotics at a startup."), say("unknown", "Cool, I’ll send you my demo later")],
  });
  expect(conv.notes?.summary).toMatch(/robotics/);
  expect(conv.notes?.summary).not.toMatch(/stub/);
  expect(conv.notes?.namesHeard).toEqual(["Dana"]);
  expect(await db.followUps.list(userId)).toEqual([]);
});

test("prepped 1:1: follow-up with the promise and a draft", async () => {
  const userId = await freshUser();
  const conv = await talk(userId, {
    personId: "p-sam",
    eventId: "evt-demo",
    transcript: [say("them", "So what are you building?"), say("me", "A voice coach. I’ll send you the deck tomorrow.")],
  });
  const [f] = await db.followUps.list(userId);
  expect(f).toMatchObject({ personId: "p-sam", eventId: "evt-demo", personName: "Sam Chen", notesStatus: "ready", conversationIds: [conv.id] });
  expect(f.promises).toEqual(["send them the deck tomorrow"]);
  expect(f.draft).toMatch(/^Hey Sam!/);
  expect(f.draft).toMatch(/send you the deck/);
  expect(f.dueAt - Date.now()).toBeLessThan(2 * 24 * 3600 * 1000); // "tomorrow" = due sooner
});

test("group with two named people: two follow-ups, names resolved to prepped people", async () => {
  const userId = await freshUser();
  await talk(userId, {
    eventId: "evt-demo",
    participants: [{ name: "Priya" }, { name: "Mo Diaz" }],
    transcript: [say("unknown", "We should totally do a hackathon together"), say("unknown", "I'll add you both on LinkedIn")],
  });
  const fs = await db.followUps.list(userId);
  expect(fs.map((f) => f.personName).sort()).toEqual(["Mo Diaz", "Priya Patel"]);
  expect(fs.find((f) => f.personName === "Priya Patel")?.personId).toBe("p-priya");
  expect(fs.every((f) => f.promises[0] === "add them both on LinkedIn")).toBe(true);
});

test("talking to the same person twice merges into one follow-up", async () => {
  const userId = await freshUser();
  const a = await talk(userId, { personId: "p-sam", transcript: [say("me", "I'll send you the deck")] });
  const b = await talk(userId, { participants: [{ name: "Sam" }], transcript: [say("me", "I'll also intro you to Priya")] });
  const fs = await db.followUps.list(userId);
  expect(fs).toHaveLength(1);
  expect(fs[0].conversationIds).toEqual([a.id, b.id]);
  expect(fs[0].promises).toEqual(["send them the deck", "also intro them to Priya"]);
});

test("labelling an unnamed conversation creates its follow-up", async () => {
  const userId = await freshUser();
  const conv = await talk(userId, { transcript: [say("unknown", "I'll send you the repo")] });
  expect(await db.followUps.list(userId)).toHaveLength(0);
  await db.conversations.update(userId, conv.id, (c) => ({ ...c, participants: [{ name: "Jordan" }] }));
  await talk(userId, { ...(await db.conversations.require(userId, conv.id)) });
  const [f] = await db.followUps.list(userId);
  expect(f).toMatchObject({ personName: "Jordan Lee", personId: "p-jordan", promises: ["send them the repo"] });
});
