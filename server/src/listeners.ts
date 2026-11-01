// Every feature that reacts to a live conversation. To plug in: write a LiveListener in your module, add it here.
import type { LiveListener } from "./modules/live/session";
import { hintsListener } from "./modules/live/hints";
import { linkCardsListener } from "./modules/linkcards/listener";
import { followUpsListener } from "./modules/followups/listener";

export const listeners: LiveListener[] = [linkCardsListener, hintsListener, followUpsListener];
