// Every background job: name -> payload schema -> handler. Slow work (LLM research, scraping) goes here,
// never in a request handler or the live path. Handlers must be idempotent (jobs can retry).
import { z } from "zod";
import { buildProfile } from "./modules/profile/build";
import { prepDossier, prepEvent } from "./modules/prep/jobs";

export const jobs = {
  "profile.build": {
    payload: z.object({ userId: z.string(), resumeText: z.string().optional(), urls: z.array(z.string()), notes: z.string().optional() }),
    run: buildProfile,
  },
  "prep.event": {
    payload: z.object({ userId: z.string(), eventId: z.string(), guestList: z.string().optional(), screenshots: z.array(z.string()).optional() }),
    run: prepEvent,
  },
  "prep.dossier": {
    payload: z.object({ userId: z.string(), personId: z.string(), fresh: z.boolean().optional() }),
    run: prepDossier,
  },
} satisfies Record<string, { payload: z.ZodType; run: (p: never) => Promise<void> }>;

export type JobName = keyof typeof jobs;
export type JobPayload<K extends JobName> = z.input<(typeof jobs)[K]["payload"]>;

export async function runJob(name: string, payload: unknown): Promise<void> {
  const job = jobs[name as JobName];
  if (!job) throw new Error(`unknown job ${name}`);
  await job.run(job.payload.parse(payload) as never);
}
