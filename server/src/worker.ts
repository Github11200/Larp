// Render Background Worker entrypoint: pulls jobs from Key Value and runs them.
import { Worker } from "bullmq";
import { env } from "./env";
import { runJob } from "./jobs";
import { QUEUE_NAME, redis } from "./lib/queue";

if (!env.redisUrl) throw new Error("worker needs REDIS_URL (locally, jobs run inline in the API instead)");

const worker = new Worker(QUEUE_NAME, (job) => runJob(job.name, job.data), { connection: redis(), concurrency: 5 });
worker.on("failed", (job, err) => console.error(`[job ${job?.name}] failed`, err));
worker.on("completed", (job) => console.log(`[job ${job.name}] done`));
console.log("worker listening on", QUEUE_NAME);
