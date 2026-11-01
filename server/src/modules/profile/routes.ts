// Chunk 3 · Knowledge base. Owns: this folder, web/src/features/profile.
import { api } from "@larp/shared";
import { Router } from "express";
import { handle } from "../../http/route";
import { db } from "../../lib/db";
import { enqueue } from "../../lib/queue";

export const profileRoutes = Router();

handle(profileRoutes, api.getProfile, ({ userId }) => db.profiles.get(userId, "me"));

handle(profileRoutes, api.putProfile, ({ userId, body }) => db.profiles.put(userId, body));

// Returns immediately with status "pending"; the job fills it in. Web polls getProfile.
handle(profileRoutes, api.buildProfile, async ({ userId, body }) => {
  const existing = await db.profiles.get(userId, "me");
  const pending = await db.profiles.put(userId, {
    ...(existing ?? { id: "me", name: "", headline: "", summary: "", skills: [], projects: [], links: [] }),
    status: "pending",
  });
  await enqueue("profile.build", { userId, ...body });
  return pending;
});
