// Chunk 1 · Text-to-speech for whispers. Yields WHISPER_AUDIO chunks as soon as they're generated.
import { env } from "../../env";

/** A whisper is a few seconds of audio; a stream still going after this is stuck. */
const TTS_TIMEOUT_MS = 8000;

export async function* synthesize(text: string): AsyncGenerator<Uint8Array> {
  if (!env.elevenLabsKey) return; // no key: hints still show on screen, just silent
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${env.elevenLabsVoiceId}/stream?output_format=pcm_24000`;
  const res = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    headers: { "xi-api-key": env.elevenLabsKey, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
  });
  if (!res.ok || !res.body) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  yield* wholeSamples(res.body);
}

/** Network chunks can split a 16-bit sample in half; the browser needs whole samples per frame. */
async function* wholeSamples(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  let carry: Uint8Array | null = null;
  for await (let chunk of body) {
    if (carry) chunk = concat(carry, chunk);
    const even = chunk.length - (chunk.length % 2);
    carry = even < chunk.length ? chunk.slice(even) : null;
    if (even > 0) yield chunk.subarray(0, even);
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}
