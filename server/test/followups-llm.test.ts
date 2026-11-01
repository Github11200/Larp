// Chunk 5 · With an LLM: its write-up wins, matched back to people by name; a failing LLM falls back.
import { expect, test, vi } from "vitest";
import { db, newId } from "../src/lib/db";
import { seedDemo } from "../src/lib/seed";
import { summarize } from "../src/modules/followups/summarize";

const askJson = vi.fn();
vi.mock("../src/lib/llm", () => ({ llmAvailable: true, askJson: (...a: unknown[]) => askJson(...a) }));

async function conversationWithSam() {
  const userId = `fu-llm-${newId()}`;
  await seedDemo(userId);
  const conv = await db.conversations.put(userId, {
    id: newId(),
    personId: "p-sam",
    startedAt: Date.now(),
    endedAt: Date.now(),
    hints: [],
    linksShared: [],
    transcript: [{ speaker: "unknown", text: "I'll send you the deck", at: Date.now() }],
  });
  return { userId, conv };
}

test("LLM write-up fills notes and the person's draft", async () => {
  askJson.mockResolvedValueOnce({
    summary: "You and Sam bonded over sub-200ms latency.",
    learned: ["Sam is hiring interns"],
    moments: ["Sam laughed at the earpiece"],
    namesHeard: ["Sam"],
    people: [{ name: "Sam", myPromises: ["send them the deck"], theirPromises: ["intro you to their CTO"], learned: ["Hiring interns"], draft: "Hey Sam! Deck attached. - Alex", dueInDays: 2 }],
  });
  const { userId, conv } = await conversationWithSam();
  await summarize({ userId, conversationId: conv.id });

  expect((await db.conversations.require(userId, conv.id)).notes).toMatchObject({ status: "ready", summary: "You and Sam bonded over sub-200ms latency." });
  const [f] = await db.followUps.list(userId);
  expect(f).toMatchObject({ personName: "Sam Chen", draft: "Hey Sam! Deck attached. - Alex", theirPromises: ["intro you to their CTO"], notesStatus: "ready" });
  expect(askJson.mock.calls[0][1].prompt).toMatch(/Sam Chen \(Founder, VoiceKit/); // dossier context reaches the prompt
});

test("LLM failure falls back to the template", async () => {
  askJson.mockRejectedValueOnce(new Error("LLM 500"));
  const { userId, conv } = await conversationWithSam();
  await summarize({ userId, conversationId: conv.id });
  const [f] = await db.followUps.list(userId);
  expect(f.promises).toEqual(["send them the deck"]);
  expect(f.draft).toMatch(/^Hey Sam!/);
});
