// Chunk 6 · Where you are in an event's story (before / during / after), derived from what's already saved.
import type { Conversation, Event, FollowUp, Person } from "@larp/shared";
import type { Stage } from "../../routes";

const day = (t: number) => new Date(t).setHours(0, 0, 0, 0);
/** Date-only strings are a calendar day in UTC terms; read them as that local day. */
const eventDay = (date: string) => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? day(new Date(`${date}T12:00:00`).getTime()) : day(Date.parse(date)));

/** Future event: prep. Past event: recap. Today (or undated): live once you've talked to someone. */
export function defaultStage(event: Event, chats: Conversation[]): Stage {
  if (event.date) {
    const d = eventDay(event.date);
    const today = day(Date.now());
    if (d > today) return "prep";
    if (d < today) return "recap";
  }
  return chats.length ? "live" : "prep";
}

/** "Tonight", "Tomorrow", "Nov 8", or nothing for undated events. */
export function whenLabel(event: Event): string | undefined {
  if (!event.date) return undefined;
  const diff = Math.round((eventDay(event.date) - day(Date.now())) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Date(eventDay(event.date)).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Attendees you've actually talked to: tagged in a chat, or owed a follow-up. */
export function metIds(chats: Conversation[], followUps: FollowUp[]): Set<string> {
  const ids = new Set<string>();
  for (const c of chats) {
    if (c.personId) ids.add(c.personId);
    for (const p of c.participants) if (p.personId) ids.add(p.personId);
  }
  for (const f of followUps) if (f.personId) ids.add(f.personId);
  return ids;
}

/** Chats where nobody matched the guest list: strangers you still need to name (or just notes). */
export const strangerChats = (chats: Conversation[]) => chats.filter((c) => !c.personId && !c.participants.some((p) => p.personId));

/** Who's in a chat, for a row title. */
export function chatTitle(c: Conversation): string {
  const names = c.participants.map((p) => p.name);
  if (!names.length) return "Someone new";
  if (names.length <= 2) return names.join(" + ");
  return `${names.slice(0, 2).join(", ")} + ${names.length - 2}`;
}

/** Ranked list split into still-to-meet and met, rank order kept. */
export function splitByMet(people: Person[], met: Set<string>) {
  return { toMeet: people.filter((p) => !met.has(p.id)), metPeople: people.filter((p) => met.has(p.id)) };
}
