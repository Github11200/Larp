// Can we tell speakers apart? Streams a two-voice TTS dialogue through Scribe and prints each line's voiceprint.
// Usage (from server/): npx tsx --env-file=../.env scripts/stt-speakers-try.ts
import { env } from "../src/env";
import { openStt } from "../src/modules/live/stt";
import { measureVoice } from "../src/modules/live/voice";

const VOICE_A = "21m00Tcm4TlvDq8ikWAM"; // premade Rachel
const VOICE_B = "pNInz6obpgDQGcFmaJgB"; // premade Adam
const TURNS: [string, string][] = [
  [VOICE_A, "Hey, what are you building this weekend?"],
  [VOICE_B, "I'm working on voice agents for dental clinics. How about you?"],
  [VOICE_A, "An earpiece that coaches you while you network."],
  [VOICE_B, "Oh nice, does it work in a loud room?"],
];
const CHUNK = 3200; // 100ms of 16kHz 16-bit mono
const GAP = Buffer.alloc(CHUNK * 3); // 300ms: a quick turn, shorter than the VAD pause

async function speak(voice: string, text: string): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=pcm_16000`, {
    method: "POST",
    headers: { "xi-api-key": env.elevenLabsKey!, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: env.elevenLabsTtsModel }),
  });
  if (!res.ok) throw new Error(`TTS ${voice} ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const clips = await Promise.all(TURNS.map(([v, t]) => speak(v, t)));
// Our own voiceprint per turn, for comparison: the far talker is simulated at -12dB.
for (const [i, clip] of clips.entries()) {
  const pcm = new Int16Array(clip.buffer, clip.byteOffset, clip.length >> 1);
  const far = pcm.map((s) => s / 4);
  console.log(`voice ${TURNS[i][0] === VOICE_A ? "A" : "B"}: near ${JSON.stringify(measureVoice(pcm, 16000))} far ${JSON.stringify(measureVoice(far, 16000))}  ${TURNS[i][1]}`);
}
if (process.argv.includes("--voices-only")) process.exit(0);
const audio = Buffer.concat([...clips.flatMap((b) => [b, GAP]), Buffer.alloc(CHUNK * 20)]);

// Scribe realtime's speaker_id came back null for every word (2026-11-01), so we measure voices ourselves.
// Through our STT wrapper: each committed line should carry a voiceprint matching its speaker.
const stt = openStt({ onPartial() {}, onCommit: (text, _s, voice) => console.log(`COMMIT ${JSON.stringify(voice)}  ${text}`) });
if (!stt) throw new Error("no ELEVENLABS_API_KEY");
for (let i = 0; i < audio.length; i += CHUNK) {
  stt.write(audio.subarray(i, i + CHUNK));
  await new Promise((r) => setTimeout(r, 100));
}
await new Promise((r) => setTimeout(r, 2000));
stt.close();
