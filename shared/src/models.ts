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
});
export type Person = z.infer<typeof Person>;

// ---------- Live (chunks 1, 2) ----------

export const Speaker = z.enum(["me", "them", "unknown"]);
export type Speaker = z.infer<typeof Speaker>;

export const Utterance = z.object({
  speaker: Speaker,
  text: z.string(),
  at: z.number(),
});
export type Utterance = z.infer<typeof Utterance>;

export const Hint = z.object({
  id: z.string(),
  text: z.string(),
  at: z.number(),
});
export type Hint = z.infer<typeof Hint>;

export const Conversation = z.object({
  id: z.string(),
  personId: z.string().optional(),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  transcript: z.array(Utterance),
  hints: z.array(Hint),
  linksShared: z.array(Link),
});
export type Conversation = z.infer<typeof Conversation>;

// ---------- After (chunk 5) ----------

export const FollowUp = z.object({
  id: z.string(),
  conversationId: z.string(),
  personId: z.string().optional(),
  personName: z.string(),
  summary: z.string(),
  promises: z.array(z.string()),
  draft: z.string(),
  dueAt: z.number(),
  status: z.enum(["open", "nudged", "done"]),
});
export type FollowUp = z.infer<typeof FollowUp>;
