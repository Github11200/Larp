// Chunk 4 · Contacts: one human across every event, conversation, and follow-up.
import { api } from "@larp/shared";
import { Router } from "express";
import { handle } from "../../http/route";
import { db } from "../../lib/db";
import { contactTimeline, listContactRows, quickAdd } from "./contacts";

export const contactRoutes = Router();

handle(contactRoutes, api.listContacts, ({ userId }) => listContactRows(userId));

handle(contactRoutes, api.getContact, ({ userId, params }) => contactTimeline(userId, params.id));

handle(contactRoutes, api.createContact, ({ userId, body }) => quickAdd(userId, body));

handle(contactRoutes, api.updateContact, ({ userId, params, body }) =>
  db.contacts.update(userId, params.id, (c) => ({ ...c, ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)) })),
);
