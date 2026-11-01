// Chunk 4 · Background jobs: research the event, rank people, write dossiers.
// No LLM key: people are listed unranked and dossiers are stubs. No Exa key: dossiers use guest-list info only.
// Every person is linked to a Contact (the same human across events).
import { Dossier, type Person } from "@larp/shared";
import { db, newId } from "../../lib/db";
import { askJson, llmAvailable } from "../../lib/llm";
import { linkContacts } from "../contacts/contacts";
import { findHuman } from "../contacts/identity";
import { cached } from "./cache";
import { neutral, RESPECT } from "./prompts";
import { rankGuests, type Rank } from "./rank";
import { researchPerson } from "./research";
import { dedupe, parseGuestList, PrepError, readScreenshots, scrapeEvent, type EventPage, type Guest } from "./sources";

export async function prepEvent(input: { userId: string; eventId: string; guestList?: string; screenshots?: string[] }): Promise<void> {
  const { userId, eventId } = input;
  try {
    const event = await db.events.require(userId, eventId);
    let unreadable: string | undefined;
    const page: EventPage = event.url
      ? await scrapeEvent(event.url).catch((e) => ((unreadable = userMessage(e)), { guests: [] }))
      : { guests: [] };
    const updated = await db.events.update(userId, eventId, (e) => ({
      ...e,
      name: page.name ?? e.name,
      description: page.description ?? e.description,
      date: page.date ?? e.date,
    }));

    // Each source is optional: a flaky one shrinks the list instead of failing the whole prep.
    const shots = await readScreenshots(input.screenshots ?? []).catch(degrade("screenshots", [] as Guest[]));
    const guests = dedupe([...page.guests, ...shots, ...parseGuestList(input.guestList)]);
    if (!guests.length) throw new PrepError(unreadable ?? emptyMessage(input, page));
    const ranks = await rankGuests(guests, await db.profiles.get(userId, "me"), updated).catch(degrade("rank", guests.map(() => ({}))));

    const people = await linkContacts(userId, mergePeople(await peopleAt(userId, eventId), guests, ranks, eventId));
    for (const p of people) await db.people.put(userId, p);
    await db.events.update(userId, eventId, (e) => ({ ...e, status: "ready", error: undefined }));
  } catch (e) {
    console.error("[prep.event]", e);
    await db.events.update(userId, eventId, (ev) => ({ ...ev, status: "error", error: userMessage(e) }));
  }
}

/** Re-prep (or a job retry) keeps everyone's id and dossier; new names are added, nobody is dropped. */
function mergePeople(existing: Person[], guests: Guest[], ranks: Rank[], eventId: string): Person[] {
  const fresh = guests.map((g, i) => {
    const prev = findHuman(existing, g);
    return {
      ...prev,
      ...defined({ ...g, ...ranks[i] }),
      links: [...new Set([...(prev?.links ?? []), ...g.links])],
      id: prev?.id ?? newId(),
      name: prev?.name ?? g.name,
      eventId,
      dossierStatus: prev?.dossierStatus ?? "none",
    } satisfies Person;
  });
  return [...fresh, ...existing.filter((p) => !fresh.some((f) => f.id === p.id))];
}

const peopleAt = async (userId: string, eventId: string) => (await db.people.list(userId)).filter((p) => p.eventId === eventId);

const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

const degrade =
  <T>(step: string, fallback: T) =>
  (e: unknown) => {
    console.warn(`[prep.event] ${step} failed, continuing without it`, e);
    return fallback;
  };

const emptyMessage = (input: { screenshots?: string[] }, page: EventPage) =>
  input.screenshots?.length
    ? "Couldn't make out any names in those screenshots. Try pasting the names instead."
    : page.name
      ? `Found "${page.name}" but the guest list is hidden. Screenshot it or paste the names.`
      : "No names to work with. Paste the guest list or drop screenshots.";

/** PrepErrors are written for the user; anything else gets a generic line (details stay in logs). */
const userMessage = (e: unknown) => (e instanceof PrepError ? e.message : "Something broke while scouting. Try again, or paste the names.");

export async function prepDossier(input: { userId: string; personId: string; fresh?: boolean }): Promise<void> {
  const { userId, personId, fresh } = input;
  try {
    const person = await db.people.require(userId, personId);
    const dossier = llmAvailable ? await writeDossier(userId, person, fresh) : stubDossier(person);
    await db.people.update(userId, personId, (p) => ({ ...p, dossierStatus: "ready", dossier }));
  } catch (e) {
    console.error("[prep.dossier]", e);
    await db.people.update(userId, personId, (p) => ({ ...p, dossierStatus: "error" }));
  }
}

async function writeDossier(userId: string, person: Person, fresh?: boolean): Promise<Dossier> {
  const [profile, event, research] = await Promise.all([
    db.profiles.get(userId, "me"),
    db.events.get(userId, person.eventId),
    // No web research is a thinner dossier, not a failed one.
    researchPerson(person).catch((e) => (console.warn("[prep.dossier] research failed", e), "")),
  ]);
  const me = profile
    ? `${profile.name}: ${profile.headline}. ${profile.summary}\nSkills: ${profile.skills.join(", ")}\nProjects: ${profile.projects.map((p) => `${p.name} (${p.description})`).join("; ")}`
    : "unknown";
  const them = `${person.name}${person.headline ? `: ${person.headline}` : ""}\nLinks: ${person.links.join(", ") || "none"}`;
  const prompt =
    `I'm about to meet someone at "${event?.name ?? "an event"}". Brief me like a hype-man who did their homework.\n\n` +
    `Me: ${me}\n\nThem: ${them}\n\nWeb search results (may include other people with the same name; ignore those):\n${research || "none"}\n\n` +
    "I'll glance at this on my phone seconds before walking up, so be brief. summary: max 2 short sentences. " +
    "workingOn, interests, commonGround: max 3 items each, max 10 words each, only things the sources support. " +
    "openers: 3 casual lines I can actually say out loud, max 15 words each, " +
    `referencing something specific about them. If you know little, say so in summary rather than inventing facts. ${RESPECT}`;
  const d = await cached("dossier", prompt, () => askJson(Dossier, { prompt }), { fresh });
  const all = (xs: string[]) => xs.map(neutral);
  return { summary: neutral(d.summary), workingOn: all(d.workingOn), interests: all(d.interests), commonGround: all(d.commonGround), openers: all(d.openers) };
}

const stubDossier = (p: Person): Dossier => ({
  summary: `[stub] ${p.name}${p.headline ? `, ${p.headline}` : ""}`,
  workingOn: [],
  interests: [],
  commonGround: [],
  openers: [`Ask ${p.name.split(" ")[0]} what they're building`],
});
