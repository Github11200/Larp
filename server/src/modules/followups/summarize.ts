// Chunk 5 · Conversation -> notes (always) + one follow-up per known person (when anyone is known).
// startWriteUp is instant (fallback content, status "pending"); the followups.summarize job fills in the real write-up.
import type { Conversation, FollowUp } from "@larp/shared";
import { db, newId } from "../../lib/db";
import { enqueue } from "../../lib/queue";
import { fallbackWriteUp, type PersonWriteUp } from "./fallback";
import { sameWho, whoWasThere, type Who } from "./participants";
import { writeUp } from "./writeup";

const DAY = 24 * 60 * 60 * 1000;

/** Called when a conversation ends or gets labelled. Fast: a few DB writes, then the job does the thinking. */
export async function startWriteUp(userId: string, conv: Conversation): Promise<void> {
  const { who, profile, event } = await context(userId, conv);
  const quick = fallbackWriteUp(conv, who, profile, event);
  const { people, ...notes } = quick;
  await db.conversations.update(userId, conv.id, (c) => ({ ...c, notes: { ...notes, status: "pending" } }));
  for (const w of who) await saveFollowUp(userId, conv, w, quick.summary, people.get(w.name)!, "pending");
  await enqueue("followups.summarize", { userId, conversationId: conv.id });
}

/** The followups.summarize job. Idempotent: re-running rewrites this conversation's notes and follow-ups. */
export async function summarize({ userId, conversationId }: { userId: string; conversationId: string }): Promise<void> {
  const conv = await db.conversations.require(userId, conversationId);
  try {
    const { who, profile, event } = await context(userId, conv);
    const earlier = (await db.followUps.list(userId)).filter((f) => f.status !== "done" && !idsOf(f).includes(conv.id));
    const w = await writeUp(conv, who, profile, event, earlier);
    const { people, ...notes } = w;
    await db.conversations.update(userId, conv.id, (c) => ({ ...c, notes: { ...notes, status: "ready" } }));
    for (const p of who) await saveFollowUp(userId, conv, p, w.summary, people.get(p.name)!, "ready");
  } catch (e) {
    console.error("[followups.summarize]", e);
    await db.conversations.update(userId, conv.id, (c) => ({ ...c, notes: c.notes && { ...c.notes, status: "error" } }));
    for (const f of await db.followUps.list(userId)) {
      if (idsOf(f).includes(conv.id) && f.notesStatus === "pending") await db.followUps.put(userId, { ...f, notesStatus: "ready" });
    }
  }
}

async function context(userId: string, conv: Conversation) {
  const [who, profile, event] = await Promise.all([
    whoWasThere(userId, conv),
    db.profiles.get(userId, "me"),
    conv.eventId ? db.events.get(userId, conv.eventId) : null,
  ]);
  return { who, profile, event };
}

const idsOf = (f: FollowUp) => (f.conversationIds.length ? f.conversationIds : [f.conversationId]);
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
const asWho = (f: FollowUp) => ({ name: f.personName, personId: f.personId, contactId: f.contactId });

/** One open follow-up per person: a second chat with the same person merges into it instead of a near-duplicate. */
async function saveFollowUp(userId: string, conv: Conversation, who: Who, summary: string, p: PersonWriteUp, notesStatus: "pending" | "ready") {
  const all = await db.followUps.list(userId);
  const existing =
    all.find((f) => idsOf(f).includes(conv.id) && sameWho(asWho(f), who)) ??
    all.find((f) => f.status !== "done" && sameWho(asWho(f), who));
  const dueAt = (conv.endedAt ?? Date.now()) + p.dueInDays * DAY;

  if (!existing) {
    await db.followUps.put(userId, {
      id: newId(),
      conversationId: conv.id,
      conversationIds: [conv.id],
      personId: who.personId,
      contactId: who.contactId,
      eventId: conv.eventId ?? who.person?.eventId,
      personName: who.name,
      summary,
      promises: p.promises,
      theirPromises: p.theirPromises,
      learned: p.learned,
      draft: p.draft,
      dueAt,
      status: "open",
      notesStatus,
    });
    return;
  }

  // Only this conversation feeds it: replace. Merged with earlier chats: add to what's there
  // (a pending fallback doesn't touch the earlier content, so the real write-up won't duplicate it).
  const solo = idsOf(existing).every((id) => id === conv.id);
  const keepEarlier = !solo && notesStatus === "pending";
  const add = (before: string[], now: string[]) => (solo ? now : keepEarlier ? before : union(before, now));
  await db.followUps.put(userId, {
    ...existing,
    conversationId: conv.id,
    conversationIds: union(idsOf(existing), [conv.id]),
    personId: existing.personId ?? who.personId,
    contactId: existing.contactId ?? who.contactId,
    eventId: existing.eventId ?? conv.eventId ?? who.person?.eventId,
    personName: who.personId ? who.name : existing.personName,
    summary: keepEarlier ? existing.summary : summary,
    promises: add(existing.promises, p.promises),
    theirPromises: add(existing.theirPromises, p.theirPromises),
    learned: add(existing.learned, p.learned),
    draft: keepEarlier ? existing.draft : p.draft,
    dueAt: solo ? dueAt : Math.min(existing.dueAt, dueAt),
    notesStatus,
  });
}
