// Loads the shared demo fixtures for one user, so any chunk can run without the others.
import { demoEvent, demoPeople, demoProfile } from "@larp/shared";
import { db } from "./db";

export async function seedDemo(userId: string): Promise<void> {
  await db.profiles.put(userId, demoProfile);
  await db.events.put(userId, demoEvent);
  for (const p of demoPeople) await db.people.put(userId, p);
}
