// Demo rigging: for the event we demo at, make sure our demo partner shows up and ranks first,
// since Luma's public page only lists a handful of the 280+ guests.
import type { Rank } from "./rank";
import type { Guest } from "./sources";

interface DemoGuest extends Guest {
  why: string;
  /** Facts the dossier must build on (we know them personally; the web won't). */
  brief: string;
}

const DEMO_EVENTS: Record<string, DemoGuest[]> = {
  // Waterloo.Dev Fest (luma.com/mtpkg8va)
  mtpkg8va: [
    {
      name: "Jinay Patel",
      headline: "UWaterloo · Programmer · Startups",
      links: ["https://www.linkedin.com/in/jinay-patel-6369002b4/"],
      why: "Fellow Waterloo builder, startup-brained, and LOVES skiing like you",
      brief:
        "We both go to the University of Waterloo and share programming and startups. " +
        "We BOTH LOVE skiing: make skiing the main talking point (lead the summary, commonGround, and at least 2 openers with it).",
    },
  ],
};

const demoFor = (url?: string) => Object.entries(DEMO_EVENTS).find(([slug]) => url?.includes(slug))?.[1] ?? [];

/** Extra guests to add for a rigged demo event. */
export const demoGuests = (url?: string): Guest[] => demoFor(url).map(({ why: _, brief: __, ...g }) => g);

/** Insider facts for a demo guest's dossier, or "" for everyone else. */
export const demoBrief = (url: string | undefined, name: string) =>
  demoFor(url).find((p) => p.name.toLowerCase() === name.toLowerCase())?.brief ?? "";

/** Demo guests always top the ranking. */
export function pinDemoRanks(url: string | undefined, guests: Guest[], ranks: Rank[]): Rank[] {
  const pinned = demoFor(url);
  return guests.map((g, i) => {
    const d = pinned.find((p) => p.name.toLowerCase() === g.name.toLowerCase());
    return d ? { score: 1, why: d.why } : ranks[i];
  });
}
