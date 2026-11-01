// Chunk 1 · Tells the user's voice from everyone else's. Scribe realtime can't (speaker_id is always empty),
// so each line gets a cheap voiceprint (pitch + loudness) and is compared with lines known to be the user's.
import type { Speaker, Voice } from "@larp/shared";

// Voice.db: loudness of voiced frames (dBFS). The phone is nearer the user's mouth, so they're usually louder.
// Voice.pitchHz: median pitch of voiced frames; undefined if too little voicing to tell.

const FRAME = 1024; // 64ms at 16kHz: room for the longest pitch period plus a comparison window
const WINDOW = 512;
const MIN_HZ = 70;
const MAX_HZ = 400;
/** Below this a frame is silence or room noise, not speech. */
const VOICED_DB = -50;
/** YIN: a dip below this in the normalized difference is a pitch period. */
const YIN_THRESHOLD = 0.15;
/** No dip below this anywhere = unvoiced (breath, "s", noise). */
const YIN_UNVOICED = 0.35;
const MIN_PITCHED_FRAMES = 5;

/** Voiceprint of a stretch of 16-bit mono PCM. */
export function measureVoice(pcm: Int16Array, sampleRate: number): Voice | undefined {
  const loud: number[] = [];
  const pitches: number[] = [];
  for (let i = 0; i + FRAME <= pcm.length; i += FRAME) {
    const frame = pcm.subarray(i, i + FRAME);
    const db = dbfs(frame);
    if (db < VOICED_DB) continue;
    loud.push(db);
    const hz = pitch(frame, sampleRate);
    if (hz) pitches.push(hz);
  }
  if (loud.length === 0) return undefined;
  return { db: round(median(loud)), pitchHz: pitches.length >= MIN_PITCHED_FRAMES ? round(median(pitches)) : undefined };
}

function dbfs(frame: Int16Array): number {
  let sum = 0;
  for (const s of frame) sum += s * s;
  return 20 * Math.log10(Math.sqrt(sum / frame.length) / 32768 || 1e-9);
}

/** YIN pitch (de Cheveigné & Kawahara): the first period whose normalized self-difference dips low. Resists octave errors. */
function pitch(frame: Int16Array, sampleRate: number): number | undefined {
  const minLag = Math.floor(sampleRate / MAX_HZ);
  const maxLag = Math.min(Math.ceil(sampleRate / MIN_HZ), frame.length - WINDOW);
  const d = new Float64Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < WINDOW; i++) {
      const diff = frame[i] - frame[i + lag];
      sum += diff * diff;
    }
    d[lag] = sum;
  }
  let running = 0;
  let best = Infinity;
  let bestLag = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    running += d[lag];
    const norm = running ? (d[lag] * lag) / running : 1;
    d[lag] = norm;
    if (lag < minLag) continue;
    if (norm < best) [best, bestLag] = [norm, lag];
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (d[lag] >= YIN_THRESHOLD) continue;
    while (lag + 1 <= maxLag && d[lag + 1] < d[lag]) lag++; // slide to the bottom of the dip
    return sampleRate / lag;
  }
  return best < YIN_UNVOICED ? sampleRate / bestLag : undefined;
}

// Loudness leads: the phone is close to the user, so others land clearly quieter (prod: user ~-21dB, others -27 to -34).
// Pitch only breaks ties: voices of the same range overlap and a line's pitch swings ~25% with intonation.
const SAME_PITCH = 0.2;
const OTHER_PITCH = 0.35;
/** Same voice within this loudness; this much quieter means farther from the phone, i.e. not the user. */
const SAME_DB = 3;
const QUIETER_DB = 6;
/** Lines of the user's voice needed before judging others against it. */
const MIN_SAMPLES = 1;
/** Until this many, the voiceprint may be off (one stray sample), so it labels but never overrules or refuses. */
const TRUSTED_SAMPLES = 3;
/** Recent samples only, so the voiceprint follows the phone as it moves. */
const MAX_SAMPLES = 8;

/** The user's voice, learned during a conversation from lines known to be theirs. */
export class SelfVoice {
  private samples: Voice[] = [];

  /** Once trusted, a sample that's clearly someone else's is refused: one bad line would mislabel the rest of the chat. */
  learn(v: Voice | undefined): void {
    if (!v || this.rejects(v)) return;
    this.samples.push(v);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  /** Clearly not the user, by a voiceprint built from enough lines to overrule what the words suggest. */
  rejects(v: Voice | undefined): boolean {
    return this.samples.length >= TRUSTED_SAMPLES && this.judge(v) === "them";
  }

  /** "me" / "them" when the voice clearly matches or doesn't; undefined leaves it to the transcript. */
  judge(v: Voice | undefined): Exclude<Speaker, "unknown"> | undefined {
    if (!v || this.samples.length < MIN_SAMPLES) return undefined;
    const db = median(this.samples.map((s) => s.db));
    const hzs = this.samples.flatMap((s) => (s.pitchHz ? [s.pitchHz] : []));
    const hz = hzs.length ? median(hzs) : undefined;
    const drift = hz && v.pitchHz ? Math.abs(v.pitchHz - hz) / hz : undefined;
    if (drift !== undefined && drift > OTHER_PITCH) return "them";
    if (v.db < db - QUIETER_DB) return "them";
    if (drift !== undefined && drift < SAME_PITCH && v.db >= db - SAME_DB) return "me"; // a close-by partner can be as loud: pitch must agree
    return undefined;
  }
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const round = (x: number) => Math.round(x * 10) / 10;
