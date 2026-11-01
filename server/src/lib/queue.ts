// enqueue() sends a job to the Render worker via Key Value (BullMQ) when REDIS_URL is set.
// Without it, the job runs in-process right away, so local dev needs no Redis.
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../env";
import type { JobName, JobPayload } from "../jobs";

export const QUEUE_NAME = "larp-jobs";

export const redis = () => new Redis(env.redisUrl!, { maxRetriesPerRequest: null });

let queue: Queue | undefined;

export async function enqueue<K extends JobName>(name: K, payload: JobPayload<K>): Promise<void> {
  if (env.redisUrl) {
    queue ??= new Queue(QUEUE_NAME, { connection: redis() });
    await queue.add(name, payload, { attempts: 2, removeOnComplete: 100, removeOnFail: 100 });
    return;
  }
  const { runJob } = await import("../jobs"); // lazy: jobs import modules that import this file
  setImmediate(() => runJob(name, payload).catch((e) => console.error(`[job ${name}]`, e)));
}
