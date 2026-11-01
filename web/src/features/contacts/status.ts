import type { ContactStatus } from "@larp/shared";

/** Where things stand with someone, in two or three words. */
export const statusLabel: Record<ContactStatus, string> = {
  listed: "on a guest list",
  prepped: "dossier ready",
  talked: "talked",
  followup: "follow-up open",
};
