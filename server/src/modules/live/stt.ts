// Chunk 1 · Speech-to-text. Mic audio in (MIC_AUDIO format), transcript events out.
// ElevenLabs Scribe realtime. It can't tell speakers apart, so every line is "unknown" and carries
// a voiceprint measured from its audio; the session and hints listener work out who said it.
import { MIC_AUDIO, type Speaker, type Voice } from "@larp/shared";
import WebSocket from "ws";
import { env } from "../../env";
import { measureVoice } from "./voice";

export interface SttEvents {
  /** In-progress text, fires often. Link cards key off this, so pass partials through as soon as they arrive. */
  onPartial(text: string, speaker: Speaker): void;
  /** A finished segment. Hints key off this. */
  onCommit(text: string, speaker: Speaker, voice?: Voice): void;
}

export interface SttStream {
  write(pcm: Buffer): void;
  close(): void;
}

const URL_PARAMS = new URLSearchParams({
  model_id: "scribe_v2_realtime",
  audio_format: `pcm_${MIC_AUDIO.sampleRate}`,
  commit_strategy: "vad",
  // Commit soon after they stop talking: this pause is most of the hint's perceived delay.
  vad_silence_threshold_secs: "0.6",
  language_code: "en",
  include_timestamps: "true", // word times locate each line's audio for its voiceprint
});

/** Audio kept for voiceprints; a line is never longer than this. */
const KEEP_SECONDS = 60;
/** The timestamped commit normally follows the plain one at once; without it, the line still goes through. */
const TIMESTAMPS_WAIT_MS = 500;

/** False without an ElevenLabs key: the phone can't be heard, so lines have to be typed. */
export const sttAvailable = Boolean(env.elevenLabsKey);

/** Scribe realtime keyterm limits. */
const MAX_KEYTERMS = 50;
const MAX_KEYTERM_CHARS = 20;

/** Bias Scribe toward these names (most important first): each first name, plus the full name when it fits. */
function keytermParams(names: string[]): URLSearchParams {
  const terms = names.flatMap((n) => [n.trim().split(/\s+/)[0], n.trim()]).filter((t) => t && t.length <= MAX_KEYTERM_CHARS);
  const params = new URLSearchParams(URL_PARAMS);
  for (const t of [...new Set(terms)].slice(0, MAX_KEYTERMS)) params.append("keyterms", t);
  return params;
}

/**
 * Returns null when STT is unavailable; the session still works via `say` messages.
 * `names` are people likely to be named out loud, so Scribe spells them right.
 */
export function openStt(events: SttEvents, names: string[] = []): SttStream | null {
  if (!env.elevenLabsKey) return null;
  const ws = new WebSocket(`wss://api.elevenlabs.io/v1/speech-to-text/realtime?${keytermParams(names)}`, {
    headers: { "xi-api-key": env.elevenLabsKey },
  });
  let ready = false;
  const pending: Buffer[] = []; // audio that arrives before the session is up
  const heard = new AudioLog();
  let untimed: NodeJS.Timeout | undefined;

  const sendAudio = (pcm: Buffer) => {
    heard.add(pcm);
    ws.send(
      JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: pcm.toString("base64"),
        commit: false,
        sample_rate: MIC_AUDIO.sampleRate,
      }),
    );
  };

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString()) as SttMessage;
    switch (msg.message_type) {
      case "session_started":
        ready = true;
        pending.splice(0).forEach(sendAudio);
        return;
      case "partial_transcript":
        if (msg.text?.trim()) events.onPartial(msg.text, "unknown");
        return;
      case "committed_transcript":
        if (msg.text?.trim()) untimed = setTimeout(() => events.onCommit(msg.text!, "unknown"), TIMESTAMPS_WAIT_MS);
        return;
      case "committed_transcript_with_timestamps": {
        clearTimeout(untimed);
        const words = msg.words?.filter((w) => w.type === "word") ?? [];
        const voice = words.length ? measureVoice(heard.slice(words[0].start, words.at(-1)!.end), MIC_AUDIO.sampleRate) : undefined;
        if (msg.text?.trim()) events.onCommit(msg.text, "unknown", voice);
        return;
      }
      default:
        if (msg.error) console.error(`[stt] ${msg.message_type}: ${msg.error}`);
    }
  });
  ws.on("error", (e) => console.error("[stt]", e.message));

  return {
    write(pcm) {
      if (ready) {
        if (ws.readyState === WebSocket.OPEN) sendAudio(pcm);
      } else if (ws.readyState <= WebSocket.OPEN) pending.push(pcm);
    },
    close() {
      clearTimeout(untimed);
      ws.close();
    },
  };
}

interface SttMessage {
  message_type: string;
  text?: string;
  error?: string;
  /** Seconds since the stream's first audio. */
  words?: { text: string; start: number; end: number; type: string }[];
}

/** The last KEEP_SECONDS of audio sent, addressable by stream time (Scribe's word timestamps). */
class AudioLog {
  private samples = new Int16Array(MIC_AUDIO.sampleRate * KEEP_SECONDS);
  private total = 0; // samples ever added

  add(pcm: Buffer): void {
    const s = new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + (pcm.length & ~1)));
    for (const x of s) this.samples[this.total++ % this.samples.length] = x;
  }

  slice(startSec: number, endSec: number): Int16Array {
    const cap = this.samples.length;
    const from = Math.max(Math.floor(startSec * MIC_AUDIO.sampleRate), this.total - cap, 0);
    const to = Math.min(Math.ceil(endSec * MIC_AUDIO.sampleRate), this.total);
    const out = new Int16Array(Math.max(to - from, 0));
    for (let i = 0; i < out.length; i++) out[i] = this.samples[(from + i) % cap];
    return out;
  }
}
