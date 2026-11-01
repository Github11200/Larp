// Every screen's URL. Link between features with these helpers, never hand-written strings.
export type SetupStep = "you" | "event" | "people";
/** An event's three stages: before, during, after. */
export type Stage = "prep" | "live" | "recap";

export const paths = {
  /** Redirects to the event that matters right now (today's, else the newest). */
  home: () => "/",
  /** First-run walkthrough; no step = the welcome screen. */
  setup: (step?: SetupStep) => (step ? `/setup/${step}` : "/setup"),
  profile: () => "/profile",
  events: () => "/events",
  /** The event hub; no stage = whichever fits the event's date and what's happened. */
  event: (id: string, stage?: Stage) => (stage ? `/events/${id}/${stage}` : `/events/${id}`),
  newEvent: () => "/events/new",
  /** One event's entry for someone (their dossier for that event). */
  person: (id: string) => `/people/${id}`,
  /** Everyone you've prepped or met, across events. */
  contacts: () => "/contacts",
  contact: (id: string) => `/contacts/${id}`,
  /** Live mode at an event, optionally already talking to someone. */
  live: (opts: { personId?: string; eventId?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.personId) q.set("person", opts.personId);
    if (opts.eventId) q.set("event", opts.eventId);
    return q.size ? `/live?${q}` : "/live";
  },
  /** Every follow-up across events (nudge links land here). Each event's Recap shows its own. */
  followUps: () => "/followups",
};
