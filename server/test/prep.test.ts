import { expect, test } from "vitest";
import { dedupe, parseGuestList } from "../src/modules/prep/sources";

test("pasted guest list splits name from headline", () => {
  expect(parseGuestList("Ada Lovelace - Analyst, Babbage Co\n\nAlan Turing\nGrace Hopper | Navy")).toEqual([
    { name: "Ada Lovelace", headline: "Analyst, Babbage Co", links: [] },
    { name: "Alan Turing", headline: undefined, links: [] },
    { name: "Grace Hopper", headline: "Navy", links: [] },
  ]);
});

test("same person from two sources merges, keeping the richer info", () => {
  const merged = dedupe([
    { name: "Ada Lovelace", headline: "Host · math", photoUrl: "p.png", links: ["https://x.com/ada"] },
    { name: "ada  lovelace", headline: "from screenshot", links: [] },
  ]);
  expect(merged).toEqual([{ name: "Ada Lovelace", headline: "Host · math", photoUrl: "p.png", links: ["https://x.com/ada"] }]);
});
