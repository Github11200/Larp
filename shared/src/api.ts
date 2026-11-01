// REST contract between web and server. Both sides import these, so a mismatch is a type error.
// Every request carries the `x-user-id` header (see USER_HEADER); data is scoped per user.
import { z } from "zod";
import { Conversation, Event, FollowUp, Participant, Person, Profile } from "./models";

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
  requestDossier: route({ method: "POST", path: "/api/people/:id/dossier", res: Person }),

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
} as const;

/** Fill `:params` in a route path. */
export function buildPath(path: string, params: Record<string, string> = {}): string {
  return path.replace(/:(\w+)/g, (_, k: string) => {
    if (!(k in params)) throw new Error(`missing path param :${k}`);
    return encodeURIComponent(params[k]);
  });
}
