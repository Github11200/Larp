// Chunk 4 · Event + people prep. Owns: this folder, web/src/features/prep.
import { api } from "@larp/shared";
import { Router } from "express";
import { handle } from "../../http/route";
import { db, newId } from "../../lib/db";
import { enqueue } from "../../lib/queue";

export const prepRoutes = Router();

handle(prepRoutes, api.listEvents, ({ userId }) => db.events.list(userId));

handle(prepRoutes, api.createEvent, async ({ userId, body }) => {
  const event = await db.events.put(userId, { id: newId(), name: body.url ?? "New event", url: body.url, status: "pending" });
  await enqueue("prep.event", { userId, eventId: event.id, guestList: body.guestList });
  return event;
});

handle(prepRoutes, api.getEvent, ({ userId, params }) => db.events.require(userId, params.id));

handle(prepRoutes, api.listPeople, async ({ userId, params }) => {
  const people = await db.people.list(userId);
  return people.filter((p) => p.eventId === params.id).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
});

handle(prepRoutes, api.getPerson, ({ userId, params }) => db.people.require(userId, params.id));

handle(prepRoutes, api.requestDossier, async ({ userId, params }) => {
  const person = await db.people.update(userId, params.id, (p) => ({ ...p, dossierStatus: "pending" }));
  await enqueue("prep.dossier", { userId, personId: person.id });
  return person;
});
