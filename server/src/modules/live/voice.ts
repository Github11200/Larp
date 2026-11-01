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

// Two voices, nearest wins: the user's (from hint read-backs) and everyone else's (from lines the LLM or a clear voice called "them").
// At a table the two are only ~3-5dB and ~10% pitch apart (prod), so fixed thresholds fail; the boundary sits between
// the two voices as heard in this conversation. Tuned offline on 36 prod lines (35 right, none wrong by voice).

/** How much one voice wobbles line to line: in dB, and in log pitch (~12%). Distances are in these units. */
const DB_SCALE = 2.5;
const PITCH_SCALE = 0.12;
/** Closer calls than this are left to the LLM. */
const MARGIN = 0.5;
/** Only very clear voice calls feed back into the model, so one bad label can't snowball. */
const SELF_TRAIN = 1.5;
/** Read-backs run quieter than the user's normal talk, so their voice is centred on its louder lines. */
const ME_LOUDNESS_QUANTILE = 0.75;
/** Recent samples only, so the model follows the phone as it moves. */
const MAX_SAMPLES = 8;
/** Before the others' voice is known: this much quieter than the user is someone else; this close (with pitch agreeing) is the user. */
const QUIETER_DB = 6;
const SAME_DB = 2;
const SAME_PITCH = 0.15;
/** User samples needed before the voice may overrule what the words say (a read-back). */
const TRUSTED_SAMPLES = 3;

interface Centre {
  db: number;
  lnHz?: number;
}

/** Who said a line, by voice, learned fresh each conversation. */
export class SpeakerVoices {
  private me: Voice[] = [];
  private them: Voice[] = [];
  /** Loudest line so far: before any read-back, the phone is nearest the user. */
  private loudest = -Infinity;

  /** A line known to be the user's (they said a hint aloud), unless the voice is clearly someone else's. */
  learnMe(v: Voice | undefined): void {
    if (v && !this.rejects(v)) push(this.me, v);
  }

  /** A line the LLM (or the user's nudge) says was someone else's; refused when the voice clearly says it's the user's. */
  learnThem(v: Voice | undefined): void {
    if (v && this.judge(v, false) !== "me") push(this.them, v);
  }

  /** Clearly not the user, by enough samples to overrule a read-back match. */
  rejects(v: Voice | undefined): boolean {
    return Boolean(v) && this.me.length >= TRUSTED_SAMPLES && this.judge(v, false) === "them" && (this.score(v!) ?? 0) < -2 * MARGIN;
  }

  /** "me" / "them" when the voice is clear; undefined leaves it to the LLM. `observe`: a real new line, so it may teach the model. */
  judge(v: Voice | undefined, observe = true): Exclude<Speaker, "unknown"> | undefined {
    if (!v) return undefined;
    const loudest = this.loudest;
    if (observe) this.loudest = Math.max(loudest, v.db);
    if (!this.me.length) return v.db < loudest - QUIETER_DB ? "them" : undefined;
    const s = this.score(v);
    const out = s === undefined ? this.judgeOneVoice(v) : s > MARGIN ? "me" : s < -MARGIN ? "them" : undefined;
    if (observe && out && s !== undefined && Math.abs(s) >= SELF_TRAIN) push(out === "me" ? this.me : this.them, v);
    return out;
  }

  /** Only the user's voice known yet: just the clear cases. */
  private judgeOneVoice(v: Voice): Exclude<Speaker, "unknown"> | undefined {
    const m = centre(this.me, ME_LOUDNESS_QUANTILE)!;
    const drift = m.lnHz !== undefined && v.pitchHz ? Math.abs(Math.log(v.pitchHz) - m.lnHz) : undefined;
    if (v.db < m.db - QUIETER_DB) return "them";
    if (v.db >= m.db - SAME_DB && drift !== undefined && drift < SAME_PITCH) return "me";
    return undefined;
  }

  /** >0 nearer the user's voice, <0 nearer the others'; undefined until both are known. */
  private score(v: Voice): number | undefined {
    const m = centre(this.me, ME_LOUDNESS_QUANTILE);
    const t = centre(this.them);
    return m && t ? distance(v, t) - distance(v, m) : undefined;
  }
}

function push(samples: Voice[], v: Voice): void {
  samples.push(v);
  if (samples.length > MAX_SAMPLES) samples.shift();
}

function centre(vs: Voice[], loudnessQuantile = 0.5): Centre | undefined {
  if (!vs.length) return undefined;
  const lnHz = vs.flatMap((v) => (v.pitchHz ? [Math.log(v.pitchHz)] : []));
  return { db: quantile(vs.map((v) => v.db), loudnessQuantile), lnHz: lnHz.length ? median(lnHz) : undefined };
}

function distance(v: Voice, c: Centre): number {
  const db = (v.db - c.db) / DB_SCALE;
  const pitch = v.pitchHz && c.lnHz !== undefined ? (Math.log(v.pitchHz) - c.lnHz) / PITCH_SCALE : 0;
  return Math.hypot(db, pitch);
}

function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
}

const median = (xs: number[]) => quantile(xs, 0.5);

const round = (x: number) => Math.round(x * 10) / 10;
