// End-to-end through the live pipeline with no mic or API keys: say -> link card + hint -> saved -> follow-up.
import type { ServerMsg } from "@larp/shared";
import { expect, test } from "vitest";
import { db } from "../src/lib/db";
import { seedDemo } from "../src/lib/seed";
import { listeners } from "../src/listeners";
import { LiveSession } from "../src/modules/live/session";

test("a conversation produces link cards, hints, and a follow-up", async () => {
  const userId = "test-live";
  await seedDemo(userId);
  const sent: ServerMsg[] = [];
  const session = new LiveSession(userId, { json: (m) => sent.push(m), binary: () => {} }, listeners);

  await session.handle({ type: "start", personId: "p-sam" });
  await session.handle({ type: "say", speaker: "them", text: "Nice! Do you have a demo?" });
  await session.handle({ type: "say", speaker: "me", text: "Yes, and I'll send you the deck tomorrow." });
  await session.handle({ type: "say", speaker: "them", text: "Do you have a demo?" });
  await session.stop();

  const types = sent.map((m) => m.type);
  expect(types).toContain("ready");
  expect(types).toContain("person");
  expect(sent.filter((m) => m.type === "link_card")).toHaveLength(1); // deduped
  expect(sent.find((m) => m.type === "hint")).toBeTruthy();
  expect(types.at(-1)).toBe("ended");

  const [conv] = await db.conversations.list(userId);
  expect(conv.transcript).toHaveLength(3);
  expect(conv.personId).toBe("p-sam");

  const [followUp] = await db.followUps.list(userId);
  expect(followUp.personName).toBe("Sam Chen");
  expect(followUp.promises).toEqual(["send them the deck tomorrow"]);
});
