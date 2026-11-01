// REST contract between web and server. Both sides import these, so a mismatch is a type error.
// Every request carries the `x-user-id` header (see USER_HEADER); data is scoped per user.
import { z } from "zod";
import { Contact, Conversation, Event, FollowUp, Participant, Person, Profile } from "./models";

export const USER_HEADER = "x-user-id";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RouteDef {
  method: Method;
  /** Express-style path, e.g. /api/people/:id */
  path: string;
  body?: z.ZodType;
  res: z.ZodType;
}

/** Keeps each route's exact schema types so both sides infer bodies and responses. */
const route = <const D extends RouteDef>(def: D) => def;

/** Request body as the sender writes it. */
export type BodyIn<D extends RouteDef> = D extends { body: infer B extends z.ZodType } ? z.input<B> : undefined;
/** Request body after validation (defaults applied). */
export type BodyOut<D extends RouteDef> = D extends { body: infer B extends z.ZodType } ? z.output<B> : undefined;
export type ResOf<D extends RouteDef> = z.output<D["res"]>;

export const BuildProfileInput = z.object({
  resumeText: z.string().optional(),
  urls: z.array(z.string()).default([]),
  /** Free-form "anything else about you" text from the user. */
  notes: z.string().optional(),
});

export const CreateEventInput = z
  .object({
    url: z.string().optional(),
    /** Pasted guest list, one person per line. Fallback when the event page can't be scraped. */
    guestList: z.string().optional(),
    /** Guest-list screenshots as image data URLs; a vision model reads the names off them. */
    screenshots: z.array(z.string()).optional(),
  })
  .refine((v) => v.url || v.guestList || v.screenshots?.length, "url, guestList, or screenshots required");

export const Ok = z.object({ ok: z.literal(true) });

/** Where things stand with a contact, for the "Your people" list. */
export const ContactStatus = z.enum(["listed", "prepped", "talked", "followup"]);
export type ContactStatus = z.infer<typeof ContactStatus>;

export const ContactRow = Contact.extend({
  status: ContactStatus,
  /** ms epoch of the latest thing that happened with them; list is sorted newest first. */
  lastAt: z.number(),
});
export type ContactRow = z.infer<typeof ContactRow>;

/** Everything you have on one human: matched by contactId, any linked personId, or participant name. */
export const ContactTimeline = z.object({
  contact: Contact,
  status: ContactStatus,
  people: z.array(Person),
  events: z.array(Event),
  conversations: z.array(Conversation),
  followUps: z.array(FollowUp),
});
export type ContactTimeline = z.infer<typeof ContactTimeline>;

export const CreateContactInput = z.object({
  name: z.string().trim().min(1),
  link: z.string().optional(),
  note: z.string().optional(),
  /** Met them at this event. */
  eventId: z.string().optional(),
});

export const UpdateContactInput = Contact.pick({ name: true, headline: true, note: true, links: true }).partial();

export const api = {
  // chunk 3 · profile
  getProfile: route({ method: "GET", path: "/api/profile", res: Profile.nullable() }),
  putProfile: route({ method: "PUT", path: "/api/profile", body: Profile, res: Profile }),
  buildProfile: route({ method: "POST", path: "/api/profile/build", body: BuildProfileInput, res: Profile }),

  // chunk 4 · prep
  listEvents: route({ method: "GET", path: "/api/events", res: z.array(Event) }),
  createEvent: route({ method: "POST", path: "/api/events", body: CreateEventInput, res: Event }),
  getEvent: route({ method: "GET", path: "/api/events/:id", res: Event }),
  listPeople: route({ method: "GET", path: "/api/events/:id/people", res: z.array(Person) }),
  getPerson: route({ method: "GET", path: "/api/people/:id", res: Person }),
  /** `fresh: true` skips cached research/LLM output (regenerate). */
  requestDossier: route({
    method: "POST",
    path: "/api/people/:id/dossier",
    body: z.object({ fresh: z.boolean().optional() }).optional(),
    res: Person,
  }),
  /** Add names/screenshots to an existing event and re-prep it; existing people keep their dossiers. */
  addGuests: route({
    method: "POST",
    path: "/api/events/:id/guests",
    body: z.object({ guestList: z.string().optional(), screenshots: z.array(z.string()).optional() }),
    res: Event,
  }),
  updateEvent: route({ method: "PATCH", path: "/api/events/:id", body: Event.pick({ name: true }).partial(), res: Event }),
  /** Also removes its people and unlinks them from contacts. */
  deleteEvent: route({ method: "DELETE", path: "/api/events/:id", res: Ok }),

  // chunk 4 · contacts (one human across events)
  listContacts: route({ method: "GET", path: "/api/contacts", res: z.array(ContactRow) }),
  getContact: route({ method: "GET", path: "/api/contacts/:id", res: ContactTimeline }),
  createContact: route({ method: "POST", path: "/api/contacts", body: CreateContactInput, res: Contact }),
  updateContact: route({ method: "PATCH", path: "/api/contacts/:id", body: UpdateContactInput, res: Contact }),

  // chunk 5 · follow-ups
  listConversations: route({ method: "GET", path: "/api/conversations", res: z.array(Conversation) }),
  /** Answer "who was this?" for a conversation; its follow-ups get (re)written. */
  labelConversation: route({
    method: "PATCH",
    path: "/api/conversations/:id",
    body: z.object({ participants: z.array(Participant) }),
    res: Conversation,
  }),
  listFollowUps: route({ method: "GET", path: "/api/followups", res: z.array(FollowUp) }),
  updateFollowUp: route({
    method: "PATCH",
    path: "/api/followups/:id",
    body: FollowUp.pick({ status: true, draft: true }).partial(),
    res: FollowUp,
  }),
  runNudges: route({ method: "POST", path: "/api/followups/nudge", res: z.object({ nudged: z.number() }) }),

  // shared · load fixtures for the current user (dev + "try the demo" button)
  seedDemo: route({ method: "POST", path: "/api/dev/seed", res: Ok }),
  /** Wipe the current user's data for a fresh demo; the profile survives when keepProfile is set. */
  resetUser: route({ method: "POST", path: "/api/dev/reset", body: z.object({ keepProfile: z.boolean().optional() }), res: Ok }),
} as const;

/** Fill `:params` in a route path. */
export function buildPath(path: string, params: Record<string, string> = {}): string {
  return path.replace(/:(\w+)/g, (_, k: string) => {
    if (!(k in params)) throw new Error(`missing path param :${k}`);
    return encodeURIComponent(params[k]);
  });
}
