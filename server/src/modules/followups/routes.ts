// Chunk 5 · Follow-up tracker. Owns: this folder, web/src/features/followups.
import { api } from "@larp/shared";
import { Router } from "express";
import { handle } from "../../http/route";
import { db } from "../../lib/db";
import { runNudges } from "./nudge";
import { startWriteUp } from "./summarize";

export const followUpRoutes = Router();

handle(followUpRoutes, api.listConversations, ({ userId }) => db.conversations.list(userId));

// "Who was this?": name the people in a conversation, then (re)write its follow-ups.
handle(followUpRoutes, api.labelConversation, async ({ userId, params, body }) => {
  const conv = await db.conversations.update(userId, params.id, (c) => ({ ...c, participants: body.participants }));
  await startWriteUp(userId, conv);
  return db.conversations.require(userId, conv.id);
});

handle(followUpRoutes, api.listFollowUps, ({ userId }) => db.followUps.list(userId));

handle(followUpRoutes, api.updateFollowUp, ({ userId, params, body }) =>
  db.followUps.update(userId, params.id, (f) => ({ ...f, ...body })),
);

// Demo trigger: "a week later" right now, for this user only.
handle(followUpRoutes, api.runNudges, async ({ userId }) => ({ nudged: await runNudges({ userId, force: true }) }));
