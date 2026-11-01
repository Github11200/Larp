// Chunk 1 · Speech-to-text. Mic audio in (MIC_AUDIO format), transcript events out.
import type { Speaker } from "@larp/shared";
import { env } from "../../env";

export interface SttEvents {
  /** In-progress text, fires often. Link cards key off this, so pass partials through as soon as they arrive. */
  onPartial(text: string, speaker: Speaker): void;
  /** A finished segment. Hints key off this. */
  onCommit(text: string, speaker: Speaker): void;
}

export interface SttStream {
  write(pcm: Buffer): void;
  close(): void;
}

/** Returns null when STT is unavailable; the session still works via `say` messages. */
export function openStt(_events: SttEvents): SttStream | null {
  if (!env.elevenLabsKey) return null;
  // TODO(chunk 1): open an ElevenLabs Scribe realtime WebSocket here, forward write() audio to it,
  // map its partial/committed transcripts to the events above. Figure out "me" vs "them" if you can.
  return null;
}
