// Real Scribe call: a TTS clip of an intro, transcribed with and without name keyterms, raw and snapped.
// Usage (from server/): npx tsx --env-file=../.env scripts/stt-names-try.ts ["spoken line"]
import { env } from "../src/env";
import { nameFixer } from "../src/modules/live/names";
import { openStt } from "../src/modules/live/stt";

const LINE = process.argv[2] ?? "Hi, I'm Nonit, and this is my friend Jinay. Jinay works with Priya.";
const NAMES = ["Nonit Gupta", "Jinay Shah", "Priya Patel"];
const CHUNK = 3200; // 100ms of 16kHz 16-bit mono

async function speak(text: string): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${env.elevenLabsVoiceId}/stream?output_format=pcm_16000`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": env.elevenLabsKey!, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: env.elevenLabsTtsModel }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Streams the clip at real-time pace plus trailing silence (so VAD commits), collecting committed lines. */
async function transcribe(pcm: Buffer, names: string[]): Promise<string[]> {
  const lines: string[] = [];
  const stt = openStt({ onPartial() {}, onCommit: (t) => lines.push(t) }, names);
  if (!stt) throw new Error("no ELEVENLABS_API_KEY");
  const audio = Buffer.concat([pcm, Buffer.alloc(CHUNK * 20)]);
  for (let i = 0; i < audio.length; i += CHUNK) {
    stt.write(audio.subarray(i, i + CHUNK));
    await new Promise((r) => setTimeout(r, 100));
  }
  await new Promise((r) => setTimeout(r, 1500));
  stt.close();
  return lines;
}

const pcm = await speak(LINE);
const fix = nameFixer(NAMES);
console.log(`said:        ${LINE}`);
for (const names of [[], NAMES]) {
  const raw = (await transcribe(pcm, names)).join(" ");
  console.log(`\nkeyterms:    ${names.length ? names.join(", ") : "(none)"}`);
  console.log(`raw:         ${raw}`);
  console.log(`snapped:     ${fix(raw)}`);
}
