// Every screen's URL. Link between features with these helpers, never hand-written strings.
export type SetupStep = "you" | "event" | "people";

export const paths = {
  /** The newest event and its people. */
  home: () => "/",
  /** First-run walkthrough; no step = the welcome screen. */
  setup: (step?: SetupStep) => (step ? `/setup/${step}` : "/setup"),
  profile: () => "/profile",
  events: () => "/events",
  event: (id: string) => `/events/${id}`,
  /** Opens the add-event form on the home screen. */
  newEvent: () => "/?new=1",
  /** One event's entry for someone (their dossier for that event). */
  person: (id: string) => `/people/${id}`,
  /** Everyone you've prepped or met, across events. */
  contacts: () => "/contacts",
  contact: (id: string) => `/contacts/${id}`,
  /** Live mode, optionally already talking to someone. */
  live: (personId?: string) => (personId ? `/live?person=${personId}` : "/live"),
  followUps: () => "/followups",
};
