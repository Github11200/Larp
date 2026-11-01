// STT mangles unusual names; known ones (me, attendees, who's here) snap back to their spelling.
import { expect, test } from "vitest";
import { nameFixer } from "../src/modules/live/names";

const fix = nameFixer(["Nonit Gupta", "Jinay Shah", "Priya Patel", "Sam Chen"]);

test("misheard known names snap to their spelling", () => {
  expect(fix("Hi, I'm No nit.")).toBe("Hi, I'm Nonit.");
  expect(fix("hey, I'm no nit, nice to meet you")).toBe("hey, I'm Nonit, nice to meet you");
  expect(fix("I'm Nonet, I build Larp")).toBe("I'm Nonit, I build Larp");
  expect(fix("And this is my friend Janae.")).toBe("And this is my friend Jinay.");
  expect(fix("Sounds good, Janae, see you later")).toBe("Sounds good, Jinay, see you later");
  expect(fix("Meet Janae Shaw")).toBe("Meet Jinay Shah");
  expect(fix("hey pria")).toBe("hey Priya");
  expect(fix("this is my friend Jinae. Jinae works with Priya.")).toBe("this is my friend Jinay. Jinay works with Priya.");
  expect(fix("I'm Nonit")).toBe("I'm Nonit");
});

test("ordinary words and other names stay", () => {
  for (const line of [
    "I have no net worth",
    "No net gain this quarter.",
    "this is no big deal",
    "Same thing happened to me",
    "I'm Jane, I love Jane Austen",
    "Janet is my cofounder",
    "I'm good, how are you",
    "Hey everyone, this is great",
    "Nonetheless, the demo worked",
  ]) {
    expect(fix(line)).toBe(line);
  }
  expect(fix("Janae is here.")).toBe("Janae is here."); // sentence start with no cue: could be anyone
});

test("no known names: text untouched", () => {
  expect(nameFixer([])("Hi, I'm No nit")).toBe("Hi, I'm No nit");
});
