// Every screen's URL. Link between features with these helpers, never hand-written strings.
export const paths = {
  home: () => "/",
  profile: () => "/profile",
  person: (id: string) => `/people/${id}`,
  /** Live mode, optionally already talking to someone. */
  live: (personId?: string) => (personId ? `/live?person=${personId}` : "/live"),
  followUps: () => "/followups",
};
