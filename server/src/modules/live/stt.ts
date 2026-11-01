// Chunk 1 · Speech-to-text. Mic audio in (MIC_AUDIO format), transcript events out.
// ElevenLabs Scribe realtime. It can't tell speakers apart, so every line is "unknown";
// the hints listener works out who said it.
import { MIC_AUDIO, type Speaker } from "@larp/shared";
import WebSocket from "ws";
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

const URL_PARAMS = new URLSearchParams({
  model_id: "scribe_v2_realtime",
  audio_format: `pcm_${MIC_AUDIO.sampleRate}`,
  commit_strategy: "vad",
  // Commit soon after they stop talking: this pause is most of the hint's perceived delay.
  vad_silence_threshold_secs: "0.6",
  language_code: "en",
});

/** False without an ElevenLabs key: the phone can't be heard, so lines have to be typed. */
export const sttAvailable = Boolean(env.elevenLabsKey);

/** Returns null when STT is unavailable; the session still works via `say` messages. */
export function openStt(events: SttEvents): SttStream | null {
  if (!env.elevenLabsKey) return null;
  const ws = new WebSocket(`wss://api.elevenlabs.io/v1/speech-to-text/realtime?${URL_PARAMS}`, {
    headers: { "xi-api-key": env.elevenLabsKey },
  });
  let ready = false;
  const pending: Buffer[] = []; // audio that arrives before the session is up

  const sendAudio = (pcm: Buffer) =>
    ws.send(
      JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: pcm.toString("base64"),
        commit: false,
        sample_rate: MIC_AUDIO.sampleRate,
      }),
    );

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString()) as { message_type: string; text?: string; error?: string };
    switch (msg.message_type) {
      case "session_started":
        ready = true;
        pending.splice(0).forEach(sendAudio);
        return;
      case "partial_transcript":
        if (msg.text?.trim()) events.onPartial(msg.text, "unknown");
        return;
      case "committed_transcript":
        if (msg.text?.trim()) events.onCommit(msg.text, "unknown");
        return;
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
      ws.close();
    },
  };
}
