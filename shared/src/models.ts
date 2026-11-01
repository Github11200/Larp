// The nouns every chunk agrees on. Change = additive only (new optional fields), see docs/contracts.md.
import { z } from "zod";

export const Status = z.enum(["pending", "ready", "error"]);
export type Status = z.infer<typeof Status>;

// ---------- You (chunk 3) ----------

export const LinkKind = z.enum(["demo", "github", "linkedin", "portfolio", "website", "resume", "other"]);
export type LinkKind = z.infer<typeof LinkKind>;

export const Link = z.object({
  kind: LinkKind,
  label: z.string(),
  url: z.string(),
});
export type Link = z.infer<typeof Link>;

export const Project = z.object({
  name: z.string(),
  description: z.string(),
  url: z.string().optional(),
});
export type Project = z.infer<typeof Project>;

/** One per user, id is always "me". */
export const Profile = z.object({
  id: z.literal("me"),
  name: z.string(),
  headline: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  projects: z.array(Project),
  links: z.array(Link),
  status: Status,
});
export type Profile = z.infer<typeof Profile>;

// ---------- Them (chunk 4) ----------

export const Event = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  status: Status,
  error: z.string().optional(),
  /** ms epoch. Events list oldest -> newest by this, so `.at(-1)` is the newest. */
  createdAt: z.number().optional(),
});
export type Event = z.infer<typeof Event>;

export const Dossier = z.object({
  summary: z.string(),
  workingOn: z.array(z.string()),
  interests: z.array(z.string()),
  commonGround: z.array(z.string()),
  openers: z.array(z.string()),
});
export type Dossier = z.infer<typeof Dossier>;

export const Person = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  headline: z.string().optional(),
  photoUrl: z.string().optional(),
  links: z.array(z.string()).default([]),
  /** Higher = more worth meeting. */
  score: z.number().optional(),
  why: z.string().optional(),
  dossierStatus: z.enum(["none", "pending", "ready", "error"]).default("none"),
  dossier: Dossier.optional(),
  /** The same human across events (contacts layer). */
  contactId: z.string().optional(),
});
export type Person = z.infer<typeof Person>;

/** One human across every event, conversation, and follow-up. Persons are per-event; a Contact links them. */
export const Contact = z.object({
  id: z.string(),
  name: z.string(),
  headline: z.string().optional(),
  photoUrl: z.string().optional(),
  links: z.array(z.string()).default([]),
  personIds: z.array(z.string()).default([]),
  eventIds: z.array(z.string()).default([]),
  note: z.string().optional(),
  createdAt: z.number(),
});
export type Contact = z.infer<typeof Contact>;

// ---------- Live (chunks 1, 2) ----------

export const Speaker = z.enum(["me", "them", "unknown"]);
export type Speaker = z.infer<typeof Speaker>;

/** A line's voiceprint from the mic audio, used to tell the user from others. */
export const Voice = z.object({ db: z.number(), pitchHz: z.number().optional() });
export type Voice = z.infer<typeof Voice>;

export const Utterance = z.object({
  speaker: Speaker,
  text: z.string(),
  at: z.number(),
  voice: Voice.optional(),
});
export type Utterance = z.infer<typeof Utterance>;

export const Hint = z.object({
  id: z.string(),
  text: z.string(),
  at: z.number(),
});
export type Hint = z.infer<typeof Hint>;

/** Someone in a conversation. Groups have several; a name caught from speech may not match anyone prepped. */
export const Participant = z.object({
  name: z.string(),
  personId: z.string().optional(),
  contactId: z.string().optional(),
});
export type Participant = z.infer<typeof Participant>;

/** What a conversation taught you, even when nobody in it has a name yet (chunk 5). */
export const ConversationNotes = z.object({
  status: Status,
  summary: z.string(),
  /** Facts about the people you talked to. */
  learned: z.array(z.string()).default([]),
  /** Notable moments and tips for next time. */
  moments: z.array(z.string()).default([]),
  /** Names the transcript mentions; suggestions for "who was this?". */
  namesHeard: z.array(z.string()).default([]),
});
export type ConversationNotes = z.infer<typeof ConversationNotes>;

export const Conversation = z.object({
  id: z.string(),
  /** Primary person, if known. Groups and unknowns live in `participants`. */
  personId: z.string().optional(),
  eventId: z.string().optional(),
  participants: z.array(Participant).default([]),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  transcript: z.array(Utterance),
  hints: z.array(Hint),
  linksShared: z.array(Link),
  notes: ConversationNotes.optional(),
});
export type Conversation = z.infer<typeof Conversation>;

// ---------- After (chunk 5) ----------

export const FollowUp = z.object({
  id: z.string(),
  conversationId: z.string(),
  personId: z.string().optional(),
  contactId: z.string().optional(),
  eventId: z.string().optional(),
  personName: z.string(),
  summary: z.string(),
  promises: z.array(z.string()),
  draft: z.string(),
  dueAt: z.number(),
  status: z.enum(["open", "nudged", "done"]),
  /** "pending" while the write-up is being generated; the fields above hold a quick fallback meanwhile. */
  notesStatus: Status.default("ready"),
  /** Things they said they'd do for you. Your own are `promises`. */
  theirPromises: z.array(z.string()).default([]),
  /** Facts about them from the conversation(s). */
  learned: z.array(z.string()).default([]),
  /** Every conversation merged into this follow-up (talking to the same person twice = one follow-up). */
  conversationIds: z.array(z.string()).default([]),
});
export type FollowUp = z.infer<typeof FollowUp>;
