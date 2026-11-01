import type { ContactStatus } from "@larp/shared";
import type { ComponentProps } from "react";
import type { Pill } from "../../components/ui";

/** Where things stand with someone, in a word or two. */
export const statusLabel: Record<ContactStatus, string> = {
  listed: "Guest list",
  prepped: "Dossier",
  talked: "Talked",
  followup: "Follow up",
};

/** Orange only when you owe them something. */
export const statusTone: Record<ContactStatus, ComponentProps<typeof Pill>["tone"]> = {
  listed: "plain",
  prepped: "plain",
  talked: "done",
  followup: "live",
};
