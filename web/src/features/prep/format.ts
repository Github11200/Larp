// Small display helpers shared by the event, person, and contact screens.

/** Date-only strings are a calendar day, so don't invent a time (or shift it a day by timezone). */
export function formatWhen(date: string | number) {
  const dayOnly = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
  return new Date(date).toLocaleString(undefined, dayOnly ? { dateStyle: "medium", timeZone: "UTC" } : { dateStyle: "medium", timeStyle: "short" });
}

/** "linkedin.com" from a link, even a scheme-less or broken one. */
export function hostOf(link: string) {
  try {
    return new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

export const hrefOf = (link: string) => (/^https?:\/\//i.test(link) ? link : `https://${link}`);

/** Server errors in the app's voice. */
export function friendlyError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/413|too large/i.test(msg)) return "Those screenshots are too chonky. Try fewer, or crop them.";
  if (/failed to fetch|network/i.test(msg)) return "Can't reach the server. Check your signal and try again.";
  return msg;
}
