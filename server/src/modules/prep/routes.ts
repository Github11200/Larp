// Chunk 4 · Event + people prep. Owns: this folder, web/src/features/prep.
import { api, type Event } from "@larp/shared";
import { Router } from "express";
import { handle } from "../../http/route";
import { db, newId } from "../../lib/db";
import { enqueue } from "../../lib/queue";
import { sortEvents, unlinkEvent } from "../contacts/contacts";

export const prepRoutes = Router();

handle(prepRoutes, api.listEvents, async ({ userId }) => {
  // Events saved before createdAt existed (or re-seeded) count as created now.
  const events = await Promise.all(
    (await db.events.list(userId)).map((e) => (e.createdAt ? e : db.events.put(userId, { ...e, createdAt: Date.now() }))),
  );
  return sortEvents(events);
});

handle(prepRoutes, api.createEvent, async ({ userId, body }) => {
  const taken = new Set((await db.events.list(userId)).map((e) => e.name));
  const event = await db.events.put(userId, { id: newId(), name: unique(defaultName(body.url), taken), url: body.url, status: "pending", createdAt: Date.now() });
  return startPrep(userId, event, body);
});

handle(prepRoutes, api.addGuests, async ({ userId, params, body }) => {
  const event = await db.events.update(userId, params.id, (e) => ({ ...e, status: "pending", error: undefined }));
  return startPrep(userId, event, body);
});

handle(prepRoutes, api.getEvent, ({ userId, params }) => db.events.require(userId, params.id));

handle(prepRoutes, api.updateEvent, ({ userId, params, body }) =>
  db.events.update(userId, params.id, (e) => ({ ...e, name: body.name?.trim() || e.name })),
);

handle(prepRoutes, api.deleteEvent, async ({ userId, params }) => {
  const people = (await db.people.list(userId)).filter((p) => p.eventId === params.id);
  for (const p of people) await db.people.remove(userId, p.id);
  await unlinkEvent(userId, params.id, people.map((p) => p.id));
  await db.events.remove(userId, params.id);
  return { ok: true as const };
});

handle(prepRoutes, api.listPeople, async ({ userId, params }) => {
  const people = await db.people.list(userId);
  return people.filter((p) => p.eventId === params.id).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
});

handle(prepRoutes, api.getPerson, ({ userId, params }) => db.people.require(userId, params.id));

handle(prepRoutes, api.requestDossier, async ({ userId, params, body }) => {
  const person = await db.people.update(userId, params.id, (p) => ({ ...p, dossierStatus: "pending" }));
  return enqueue("prep.dossier", { userId, personId: person.id, fresh: body?.fresh }).then(
    () => person,
    (err) => {
      console.error("[prep] enqueue failed", err);
      return db.people.put(userId, { ...person, dossierStatus: "error" });
    },
  );
});

/** A job that never starts must not leave the event pending forever. */
function startPrep(userId: string, event: Event, input: { guestList?: string; screenshots?: string[] }) {
  return enqueue("prep.event", { userId, eventId: event.id, guestList: input.guestList, screenshots: input.screenshots }).then(
    () => event,
    (err) => {
      console.error("[prep] enqueue failed", err);
      return db.events.put(userId, { ...event, status: "error", error: "Couldn't start scouting (the job queue is napping). Try again in a sec." });
    },
  );
}

/** Pasted lists have no page title; name it after the day so it's tellable apart from the others. */
function defaultName(url?: string) {
  if (url) return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
  return `Mystery mixer, ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/** Two mixers on the same day stay tellable apart in the switcher. */
function unique(name: string, taken: Set<string>) {
  let n = 1;
  while (taken.has(n === 1 ? name : `${name} #${n}`)) n++;
  return n === 1 ? name : `${name} #${n}`;
}
