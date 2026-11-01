// Chunk 1 · Text-to-speech for whispers. Yields WHISPER_AUDIO chunks as soon as they're generated.
import { env } from "../../env";

export async function* synthesize(_text: string): AsyncGenerator<Uint8Array> {
  if (!env.elevenLabsKey) return; // no key: hints still show on screen, just silent
  // TODO(chunk 1): stream from ElevenLabs Flash TTS (pcm_24000 output) and yield each chunk.
}
