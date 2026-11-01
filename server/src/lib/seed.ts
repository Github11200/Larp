// Loads the shared demo fixtures for one user, so any chunk can run without the others.
import { demoEvent, demoPeople, demoProfile } from "@larp/shared";
import { db } from "./db";

export async function seedDemo(userId: string): Promise<void> {
  // "Just show me the demo" after building your own profile must not swap you for Alex Rivera.
  if (!(await db.profiles.get(userId, "me"))) await db.profiles.put(userId, demoProfile);
  await db.events.put(userId, demoEvent);
  for (const p of demoPeople) await db.people.put(userId, p);
}

export async function resetUser(userId: string, keepProfile = false): Promise<void> {
  for (const [name, coll] of Object.entries(db)) {
    if (keepProfile && name === "profiles") continue;
    for (const doc of await coll.list(userId)) await coll.remove(userId, doc.id);
  }
}
