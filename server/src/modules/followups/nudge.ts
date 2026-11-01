// Chunk 5 · Marks due follow-ups as nudged. Runs from the Render Cron Job and the manual demo trigger.
import { db } from "../../lib/db";

/** userId given = only that user (demo button); omitted = everyone (cron). Returns how many were nudged. */
export async function runNudges(opts: { userId?: string; force?: boolean } = {}): Promise<number> {
  const all = await db.followUps.scan();
  const due = all.filter(
    ({ userId, doc }) =>
      doc.status === "open" && (opts.force || doc.dueAt <= Date.now()) && (!opts.userId || userId === opts.userId),
  );
  for (const { userId, doc } of due) {
    // TODO(chunk 5): actually reach the user (email, push, SMS). The in-app list already shows "nudged".
    await db.followUps.put(userId, { ...doc, status: "nudged" });
  }
  return due.length;
}
