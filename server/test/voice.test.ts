// Voiceprints: pitch and loudness from raw PCM, and judging lines against the user's learned voice.
import { expect, test } from "vitest";
import { measureVoice, SelfVoice } from "../src/modules/live/voice";

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

test("judges a line against the user's voice: same pitch is me, other pitch or much quieter is them", () => {
  const me = new SelfVoice();
  expect(me.judge({ db: -20, pitchHz: 120 })).toBeUndefined(); // nothing learned yet
  me.learn({ db: -20, pitchHz: 120 });
  expect(me.judge({ db: -22, pitchHz: 126 })).toBe("me");
  expect(me.judge({ db: -20, pitchHz: 210 })).toBe("them");
  expect(me.judge({ db: -35, pitchHz: 124 })).toBe("them"); // far from the mic
  expect(me.judge({ db: -21, pitchHz: 145 })).toBeUndefined(); // in between: leave it to the transcript
});

test("loudness leads (prod levels): the user ~-21dB, others -29 to -34dB in the same pitch range", () => {
  const me = new SelfVoice();
  me.learn({ db: -21.5, pitchHz: 164.5 });
  expect(me.judge({ db: -21.7, pitchHz: 149.5 })).toBe("me");
  expect(me.judge({ db: -29.5, pitchHz: 132.8 })).toBe("them");
  expect(me.judge({ db: -33.7, pitchHz: 126 })).toBe("them");
  expect(me.judge({ db: -22, pitchHz: undefined })).toBeUndefined(); // loud but unpitched: could be a close-by partner
});

test("an early stray sample can't lock the voiceprint; once trusted, others' voices are refused", () => {
  const me = new SelfVoice();
  me.learn({ db: -33, pitchHz: 220 }); // someone else's line mistaken for the user's
  for (let i = 0; i < 4; i++) me.learn({ db: -21, pitchHz: 130 });
  expect(me.judge({ db: -21, pitchHz: 132 })).toBe("me");
  expect(me.rejects({ db: -34, pitchHz: 220 })).toBe(true);
  me.learn({ db: -34, pitchHz: 220 }); // refused
  expect(me.judge({ db: -21, pitchHz: 132 })).toBe("me");
});
