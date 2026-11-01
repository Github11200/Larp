// Chunk 4 · Background jobs: research the event, rank people, write dossiers.
// No LLM key: people are listed unranked and dossiers are stubs. No Exa key: dossiers use guest-list info only.
import { Dossier, type Person } from "@larp/shared";
import { db, newId } from "../../lib/db";
import { askJson, llmAvailable } from "../../lib/llm";
import { cached } from "./cache";
import { RESPECT } from "./prompts";
import { rankGuests } from "./rank";
import { researchPerson } from "./research";
import { dedupe, parseGuestList, readScreenshots, scrapeEvent, type EventPage } from "./sources";

export async function prepEvent(input: { userId: string; eventId: string; guestList?: string; screenshots?: string[] }): Promise<void> {
  const { userId, eventId } = input;
  try {
    const event = await db.events.require(userId, eventId);
    const page: EventPage = event.url ? await scrapeEvent(event.url).catch(() => ({ guests: [] })) : { guests: [] };
    const updated = await db.events.update(userId, eventId, (e) => ({
      ...e,
      name: page.name ?? (e.url ? e.name : "Your event"),
      description: page.description ?? e.description,
      date: page.date ?? e.date,
    }));

    const guests = dedupe([...page.guests, ...(await readScreenshots(input.screenshots ?? [])), ...parseGuestList(input.guestList)]);
    const ranks = await rankGuests(guests, await db.profiles.get(userId, "me"), updated);

    // Jobs can retry: replace this event's people rather than adding duplicates.
    for (const p of await db.people.list(userId)) if (p.eventId === eventId) await db.people.remove(userId, p.id);
    for (const [i, g] of guests.entries()) {
      await db.people.put(userId, { id: newId(), eventId, ...g, ...ranks[i], dossierStatus: "none" });
    }
    await db.events.update(userId, eventId, (e) => ({ ...e, status: "ready" }));
  } catch (e) {
    console.error("[prep.event]", e);
    await db.events.update(userId, eventId, (ev) => ({ ...ev, status: "error", error: String(e) }));
  }
}

export async function prepDossier(input: { userId: string; personId: string }): Promise<void> {
  const { userId, personId } = input;
  try {
    const person = await db.people.require(userId, personId);
    const dossier = llmAvailable ? await writeDossier(userId, person) : stubDossier(person);
    await db.people.update(userId, personId, (p) => ({ ...p, dossierStatus: "ready", dossier }));
  } catch (e) {
    console.error("[prep.dossier]", e);
    await db.people.update(userId, personId, (p) => ({ ...p, dossierStatus: "error" }));
  }
}

async function writeDossier(userId: string, person: Person): Promise<Dossier> {
  const [profile, event, research] = await Promise.all([
    db.profiles.get(userId, "me"),
    db.events.get(userId, person.eventId),
    researchPerson(person),
  ]);
  const me = profile
    ? `${profile.name}: ${profile.headline}. ${profile.summary}\nSkills: ${profile.skills.join(", ")}\nProjects: ${profile.projects.map((p) => `${p.name} (${p.description})`).join("; ")}`
    : "unknown";
  const them = `${person.name}${person.headline ? `: ${person.headline}` : ""}\nLinks: ${person.links.join(", ") || "none"}`;
  const prompt =
    `I'm about to meet someone at "${event?.name ?? "an event"}". Brief me like a hype-man who did their homework.\n\n` +
    `Me: ${me}\n\nThem: ${them}\n\nWeb search results (may include other people with the same name; ignore those):\n${research || "none"}\n\n` +
    "summary: 1-2 sentences on who they are. workingOn, interests: short phrases, only things the sources support. " +
    "commonGround: overlaps between me and them. openers: 3 casual lines I can actually say out loud, max 15 words each, " +
    `referencing something specific about them. If you know little, say so in summary rather than inventing facts. ${RESPECT}`;
  return cached("dossier", prompt, () => askJson(Dossier, { prompt }));
}

const stubDossier = (p: Person): Dossier => ({
  summary: `[stub] ${p.name}${p.headline ? `, ${p.headline}` : ""}`,
  workingOn: [],
  interests: [],
  commonGround: [],
  openers: [`Ask ${p.name.split(" ")[0]} what they're building`],
});
