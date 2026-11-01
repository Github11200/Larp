// Voiceprints: pitch and loudness from raw PCM, and judging lines against the user's learned voice.
import { expect, test } from "vitest";
import { measureVoice, SpeakerVoices } from "../src/modules/live/voice";

const RATE = 16000;

/** A buzzy vowel-like tone: a fundamental plus harmonics, like voiced speech. */
function tone(hz: number, amplitude: number, seconds = 1): Int16Array {
  const out = new Int16Array(RATE * seconds);
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    out[i] = amplitude * (Math.sin(2 * Math.PI * hz * t) + 0.5 * Math.sin(4 * Math.PI * hz * t) + 0.25 * Math.sin(6 * Math.PI * hz * t)) / 1.75;
  }
  return out;
}

test("measures pitch and loudness of voiced audio; silence has no voice", () => {
  const low = measureVoice(tone(120, 8000), RATE)!;
  const high = measureVoice(tone(220, 8000), RATE)!;
  expect(low.pitchHz).toBeGreaterThan(110);
  expect(low.pitchHz).toBeLessThan(130);
  expect(high.pitchHz).toBeGreaterThan(205);
  expect(high.pitchHz).toBeLessThan(235);
  expect(measureVoice(tone(120, 1000), RATE)!.db).toBeLessThan(low.db - 15);
  expect(measureVoice(new Int16Array(RATE), RATE)).toBeUndefined();
});

type Path = "readback" | "voice" | "llm-me" | "llm-them";
/** Replays lines the way the session does: read-backs teach the user's voice; the rest are judged, the LLM fills the gaps. */
function replay(lines: [number, number | undefined, Path][]) {
  const v = new SpeakerVoices();
  return lines.map(([db, pitchHz, path]) => {
    const voice = { db, pitchHz };
    if (path === "readback" && !v.rejects(voice)) return v.learnMe(voice), "me";
    const heard = v.judge(voice) ?? (path === "llm-me" ? "me" : path === "llm-them" ? "them" : undefined);
    if (heard === "them") v.learnThem(voice);
    return heard;
  });
}

// Prod conversation c678586c (voiceprints and who really spoke only). The old one-voice rule called the other person's
// last five lines the user's, so the coach went silent on their closing question.
const AT_A_TABLE: [number, number | undefined, Path, string][] = [
  [-23.7, 137.9, "llm-me", "me"], [-30.2, 122.1, "voice", "them"], [-25.2, 155.3, "readback", "me"],
  [-30.8, 120.3, "llm-them", "them"], [-26.5, 128, "readback", "me"], [-30.6, 117.6, "voice", "them"],
  [-22, 131.1, "readback", "me"], [-31.9, 118.1, "voice", "them"], [-22.2, 126, "voice", "me"], [-22.3, 129, "voice", "me"],
  [-37.4, 131.7, "voice", "them"], [-23.7, 122.1, "voice", "me"], [-29.9, 123.1, "voice", "them"], [-25.9, 121.2, "readback", "me"],
  [-29.9, 117.6, "voice", "them"], [-24.8, 128, "readback", "me"], [-27.6, 125, "voice", "them"], [-22.6, 127, "voice", "me"],
  [-24.3, 149.5, "readback", "me"], [-27.9, 136.8, "voice", "them"], [-30.5, 112.7, "voice", "them"], [-21.7, 133.3, "readback", "me"],
  [-27.4, 119.4, "voice", "them"], [-29.4, 116.8, "voice", "them"], [-27.6, 119.4, "voice", "them"],
];

test("two voices at a table, only ~4dB apart: every line lands on the right speaker (prod replay)", () => {
  const got = replay(AT_A_TABLE.map(([db, hz, path]) => [db, hz, path]));
  expect(got).toEqual(AT_A_TABLE.map((l) => l[3]));
});

test("before the others' voice is known: much quieter is them, close in loudness and pitch is me, in between is left to the LLM", () => {
  const v = new SpeakerVoices();
  expect(v.judge({ db: -20, pitchHz: 120 })).toBeUndefined(); // nothing learned yet
  v.learnMe({ db: -20, pitchHz: 120 });
  expect(v.judge({ db: -21, pitchHz: 125 })).toBe("me");
  expect(v.judge({ db: -28, pitchHz: 124 })).toBe("them"); // far from the mic
  expect(v.judge({ db: -24, pitchHz: 122 })).toBeUndefined();
  expect(v.judge({ db: -21, pitchHz: undefined })).toBeUndefined(); // unpitched: could be a close-by partner
});

test("a line far quieter than the loudest yet is someone else's, even before the user's voice is learned", () => {
  const v = new SpeakerVoices();
  expect(v.judge({ db: -23.3, pitchHz: 142.9 })).toBeUndefined();
  expect(v.judge({ db: -33.7, pitchHz: 113.9 })).toBe("them"); // prod: "Hi, Nonit. I'm Janine" was called the user's
});

test("once trusted, a read-back match in someone else's voice is refused, and the LLM can't teach the user's voice as theirs", () => {
  const v = new SpeakerVoices();
  for (const db of [-21, -22, -21.5]) v.learnMe({ db, pitchHz: 130 });
  v.learnThem({ db: -30, pitchHz: 118 });
  expect(v.rejects({ db: -31, pitchHz: 117 })).toBe(true);
  expect(v.rejects({ db: -21.5, pitchHz: 131 })).toBe(false);
  v.learnThem({ db: -21, pitchHz: 130 }); // an LLM mislabel of the user's own line: refused
  expect(v.judge({ db: -21.5, pitchHz: 129 })).toBe("me");
});
