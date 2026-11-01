// HTTP app: one router per chunk. Mount new routers here.
import { api } from "@larp/shared";
import cors from "cors";
import express, { Router } from "express";
import { env } from "./env";
import { handle } from "./http/route";
import { seedHistory } from "./lib/history";
import { resetUser, seedDemo } from "./lib/seed";
import { contactRoutes } from "./modules/contacts/routes";
import { followUpRoutes } from "./modules/followups/routes";
import { prepRoutes } from "./modules/prep/routes";
import { profileRoutes } from "./modules/profile/routes";

export function createApp() {
  const app = express();
  // Our own Render static site is always allowed, so a typo in WEB_ORIGIN can't take the whole demo down.
  app.use(cors({ origin: env.webOrigins ? [...env.webOrigins, /^https:\/\/larp-web[\w-]*\.onrender\.com$/] : true }));
  app.use(express.json({ limit: "5mb" }));

  app.get("/health", (_req, res) => void res.json({ ok: true }));

  const dev = Router();
  handle(dev, api.seedDemo, async ({ userId }) => {
    await seedDemo(userId);
    return { ok: true as const };
  });
  handle(dev, api.seedHistory, async ({ userId }) => {
    await seedHistory(userId);
    return { ok: true as const };
  });
  handle(dev, api.resetUser, async ({ userId, body }) => {
    await resetUser(userId, body.keepProfile);
    return { ok: true as const };
  });

  app.use(profileRoutes, prepRoutes, contactRoutes, followUpRoutes, dev);
  return app;
}
