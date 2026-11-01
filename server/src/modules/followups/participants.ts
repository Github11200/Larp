// Chunk 5 · Who was in a conversation, resolved to prepped people where possible,
// so follow-ups carry personId/contactId and the contacts layer can find them.
import type { Conversation, Person } from "@larp/shared";
import { db } from "../../lib/db";

export interface Who {
  name: string;
  personId?: string;
  contactId?: string;
  person?: Person;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export const firstName = (name: string) => name.trim().split(/\s+/)[0];

/** Named participants plus the primary person; names caught from speech ("Sam") match prepped people. */
export async function whoWasThere(userId: string, conv: Conversation): Promise<Who[]> {
  const people = await db.people.list(userId);
  const raw = [...conv.participants];
  if (conv.personId && !raw.some((p) => p.personId === conv.personId)) raw.unshift({ name: "", personId: conv.personId });

  const out: Who[] = [];
  for (const p of raw) {
    const person = (p.personId && people.find((x) => x.id === p.personId)) || matchByName(people, p.name, conv.eventId);
    const name = person?.name ?? p.name.trim();
    if (!name) continue;
    const who: Who = { name, personId: person?.id ?? p.personId, contactId: p.contactId ?? person?.contactId, person: person || undefined };
    if (!out.some((o) => sameWho(o, who))) out.push(who);
  }
  return out;
}

/** Full-name match, else a first name that only one prepped person has (same event preferred). */
function matchByName(people: Person[], name: string, eventId?: string): Person | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const full = people.filter((p) => norm(p.name) === n);
  if (full.length) return full.find((p) => p.eventId === eventId) ?? full[0];
  const byFirst = people.filter((p) => norm(firstName(p.name)) === n);
  const sameEvent = byFirst.filter((p) => p.eventId === eventId);
  if (sameEvent.length === 1) return sameEvent[0];
  return byFirst.length === 1 ? byFirst[0] : undefined;
}

export function sameWho(a: { personId?: string; contactId?: string; name: string }, b: { personId?: string; contactId?: string; name: string }) {
  if (a.personId && b.personId) return a.personId === b.personId;
  if (a.contactId && b.contactId) return a.contactId === b.contactId;
  return norm(a.name) === norm(b.name);
}
