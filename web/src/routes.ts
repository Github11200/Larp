// Every screen's URL. Link between features with these helpers, never hand-written strings.
export type SetupStep = "you" | "event" | "people";

export const paths = {
  home: () => "/",
  /** First-run walkthrough; no step = the welcome screen. */
  setup: (step?: SetupStep) => (step ? `/setup/${step}` : "/setup"),
  profile: () => "/profile",
  person: (id: string) => `/people/${id}`,
  /** Live mode, optionally already talking to someone. */
  live: (personId?: string) => (personId ? `/live?person=${personId}` : "/live"),
  followUps: () => "/followups",
};
