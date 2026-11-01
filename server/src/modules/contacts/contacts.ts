// Contacts layer: one Contact per human, linking their per-event Persons, conversations, and follow-ups.
import type { Contact, ContactStatus, ContactTimeline, Conversation, Event, FollowUp, Person } from "@larp/shared";
import { db, newId } from "../../lib/db";
import { findHuman, normName } from "./identity";

/** Placeholder names from live/follow-ups that aren't anyone in particular. */
const NOBODY = new Set(["", "unknown", "someone", "them", "stranger", "unknown person", "new person"]);

/** Upsert a contact for each person, stamp person.contactId, and fill gaps from the contact. Callers save the returned people. */
export async function linkContacts(userId: string, people: Person[]): Promise<Person[]> {
  const contacts = await db.contacts.list(userId);
  const out: Person[] = [];
  for (const p of people) {
    const found = contacts.find((c) => c.id === p.contactId) ?? findHuman(contacts, p);
    const c = found ?? blankContact(p.name);
    if (!found) contacts.push(c);
    Object.assign(c, {
      headline: p.headline ?? c.headline,
      photoUrl: p.photoUrl ?? c.photoUrl,
      links: union(c.links, p.links),
      personIds: union(c.personIds, [p.id]),
      eventIds: union(c.eventIds, [p.eventId]),
    });
    await db.contacts.put(userId, c);
    // A bare name on this list still gets what we learned about them at earlier events.
    out.push({ ...p, contactId: c.id, headline: p.headline ?? c.headline, photoUrl: p.photoUrl ?? c.photoUrl, links: c.links });
  }
  return out;
}

/** "Met someone not on the list": merge into an existing contact, or create one (plus a Person at the event). */
export async function quickAdd(userId: string, input: { name: string; link?: string; note?: string; eventId?: string }): Promise<Contact> {
  const links = input.link?.trim() ? [input.link.trim()] : [];
  const contacts = await db.contacts.list(userId);
  const c = findHuman(contacts, { name: input.name, links }) ?? blankContact(input.name.trim());
  c.links = union(c.links, links);
  if (input.note?.trim()) c.note = [c.note, input.note.trim()].filter(Boolean).join("\n");
  await db.contacts.put(userId, c);
  if (input.eventId && !c.eventIds.includes(input.eventId)) {
    // Shows up in the event's list and the live people strip, so hints can use them.
    const person: Person = { id: newId(), eventId: input.eventId, name: c.name, links: c.links, why: "Off-list legend. Met in the wild.", dossierStatus: "none" };
    const [linked] = await linkContacts(userId, [person]);
    await db.people.put(userId, linked);
  }
  return db.contacts.require(userId, c.id);
}

/** Drop an event's people from contacts; contacts left with nothing are removed. */
export async function unlinkEvent(userId: string, eventId: string, personIds: string[]): Promise<void> {
  for (const c of await db.contacts.list(userId)) {
    if (!c.eventIds.includes(eventId) && !c.personIds.some((id) => personIds.includes(id))) continue;
    c.eventIds = c.eventIds.filter((id) => id !== eventId);
    c.personIds = c.personIds.filter((id) => !personIds.includes(id));
    if (!c.eventIds.length && !c.personIds.length && !c.note) await db.contacts.remove(userId, c.id);
    else await db.contacts.put(userId, c);
  }
}

interface World {
  contacts: Contact[];
  people: Person[];
  events: Event[];
  conversations: Conversation[];
  followUps: FollowUp[];
}

async function loadWorld(userId: string): Promise<World> {
  const [contacts, people, events, conversations, followUps] = await Promise.all([
    db.contacts.list(userId),
    db.people.list(userId),
    db.events.list(userId),
    db.conversations.list(userId),
    db.followUps.list(userId),
  ]);
  return { contacts, people, events, conversations, followUps };
}

/**
 * Catch up contacts with data written elsewhere: people saved without a contact (demo seed) and
 * names from conversations/follow-ups that match nobody (met live, never on a list). Idempotent.
 */
async function syncContacts(userId: string): Promise<World> {
  let w = await loadWorld(userId);
  const unlinked = w.people.filter((p) => !p.contactId || !w.contacts.some((c) => c.id === p.contactId));
  // Patch only contactId: a dossier job may be writing the same person right now.
  for (const p of await linkContacts(userId, unlinked)) await db.people.update(userId, p.id, (x) => ({ ...x, contactId: p.contactId }));

  const contacts = unlinked.length ? await db.contacts.list(userId) : w.contacts;
  const strangers = new Map<string, string>();
  const names = [
    ...w.conversations.flatMap((cv) => cv.participants.filter((pt) => !pt.contactId && !pt.personId).map((pt) => pt.name)),
    ...w.followUps.filter((f) => !f.contactId && !f.personId).map((f) => f.personName),
  ];
  for (const name of names) {
    const key = normName(name);
    if (NOBODY.has(key) || strangers.has(key) || contacts.some((c) => normName(c.name) === key)) continue;
    strangers.set(key, name.trim());
  }
  for (const name of strangers.values()) await db.contacts.put(userId, blankContact(name));

  if (unlinked.length || strangers.size) w = await loadWorld(userId);
  return w;
}

export async function listContactRows(userId: string) {
  const w = await syncContacts(userId);
  return w.contacts
    .map((c) => {
      const t = timelineIn(w, c);
      return { ...c, status: t.status, lastAt: lastAt(t) };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}

export async function contactTimeline(userId: string, id: string): Promise<ContactTimeline> {
  const w = await loadWorld(userId);
  const contact = await db.contacts.require(userId, id);
  return timelineIn(w, contact);
}

/** Matched by contactId, else any linked personId, else participant name (unknown/group chats only carry a name). */
function timelineIn(w: World, c: Contact): ContactTimeline {
  const pids = new Set(c.personIds);
  const name = normName(c.name);
  const isThem = (who: { contactId?: string; personId?: string; name: string }) =>
    who.contactId ? who.contactId === c.id : (who.personId && pids.has(who.personId)) || normName(who.name) === name;

  const people = w.people.filter((p) => p.contactId === c.id || pids.has(p.id));
  const eventIds = new Set([...c.eventIds, ...people.map((p) => p.eventId)]);
  const events = sortEvents(w.events.filter((e) => eventIds.has(e.id)));
  const conversations = w.conversations
    .filter((cv) => (cv.personId && pids.has(cv.personId)) || cv.participants.some(isThem))
    .sort((a, b) => b.startedAt - a.startedAt);
  // A follow-up from a one-on-one with them is theirs even if its name is a guess.
  const oneOnOnes = new Set(conversations.filter((cv) => cv.participants.length <= 1).map((cv) => cv.id));
  const followUps = w.followUps.filter(
    (f) => isThem({ ...f, name: f.personName }) || [f.conversationId, ...f.conversationIds].some((id) => oneOnOnes.has(id)),
  );
  return { contact: c, status: statusOf(people, conversations, followUps), people, events, conversations, followUps };
}

function statusOf(people: Person[], conversations: Conversation[], followUps: FollowUp[]): ContactStatus {
  if (followUps.some((f) => f.status !== "done")) return "followup";
  if (conversations.length) return "talked";
  if (people.some((p) => p.dossierStatus === "ready")) return "prepped";
  return "listed";
}

const lastAt = (t: ContactTimeline) =>
  Math.max(t.contact.createdAt, ...t.events.map((e) => e.createdAt ?? 0), ...t.conversations.map((cv) => cv.endedAt ?? cv.startedAt));

/** Oldest -> newest, so `.at(-1)` is the newest. */
export const sortEvents = (events: Event[]) => [...events].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

const blankContact = (name: string): Contact => ({ id: newId(), name, links: [], personIds: [], eventIds: [], createdAt: Date.now() });

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
