// Chunk 4 · Background jobs: research the event, rank people, write dossiers.
import { db, newId } from "../../lib/db";

export async function prepEvent(input: { userId: string; eventId: string; guestList?: string }): Promise<void> {
  // TODO(chunk 4): scrape the event page (url), extract name/description/guests, rank guests against the profile.
  // Stub: one person per pasted guest-list line, unranked.
  const names = (input.guestList ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  for (const name of names) {
    await db.people.put(input.userId, { id: newId(), eventId: input.eventId, name, links: [], dossierStatus: "none" });
  }
  await db.events.update(input.userId, input.eventId, (e) => ({ ...e, status: "ready" }));
}

export async function prepDossier(input: { userId: string; personId: string }): Promise<void> {
  // TODO(chunk 4): research the person, then askJson(Dossier, { model: "smart", ... }).
  await db.people.update(input.userId, input.personId, (p) => ({
    ...p,
    dossierStatus: "ready",
    dossier: { summary: `[stub] ${p.name}`, workingOn: [], interests: [], commonGround: [], openers: [`Ask ${p.name} what they're building`] },
  }));
}
