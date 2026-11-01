// Where attendees come from: the public event page, guest-list screenshots, or pasted names.
// Luma hides the full guest list behind login, but its public page still has hosts + featured guests.
import { z } from "zod";
import { askJson, llmAvailable } from "../../lib/llm";
import { cached } from "./cache";

export interface Guest {
  name: string;
  headline?: string;
  photoUrl?: string;
  links: string[];
}

export interface EventPage {
  name?: string;
  description?: string;
  date?: string;
  guests: Guest[];
}

/** A prep failure the user can act on; the message is shown as-is. */
export class PrepError extends Error {}

const UNREADABLE = "Couldn't read that link (the page ghosted us). Paste the guest list or drop screenshots instead.";

/** Pages without guests aren't cached, so a fixed or newly public page is re-read next time. */
export function scrapeEvent(url: string): Promise<EventPage> {
  return cached("event", url, () => fetchEventPage(url), { keep: (p) => p.guests.length > 0 });
}

async function fetchEventPage(url: string): Promise<EventPage> {
  const res = await fetch(normalizeLink(url), { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) throw new PrepError(UNREADABLE);
  const html = await res.text();
  const page = lumaPage(html) ?? genericPage(html);
  // Luma serves its 404 page as a 200.
  if (!page.name || /not found|\b404\b/i.test(page.name)) throw new PrepError(UNREADABLE);
  return page;
}

/** Bios have "example.com" and "@handle"; links must be absolute to open (and to dedupe). */
export function normalizeLink(link: string): string {
  const l = link.trim();
  return /^https?:\/\//i.test(l) ? l : `https://${l.replace(/^\/+/, "")}`;
}

interface LumaPerson {
  name: string;
  bio_short?: string;
  avatar_url?: string;
  linkedin_handle?: string;
  twitter_handle?: string;
  website?: string;
}

function lumaPage(html: string): EventPage | undefined {
  const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)?.[1];
  const data = json && JSON.parse(json).props?.pageProps?.initialData?.data;
  if (!data?.event) return undefined;
  const hosts = ((data.hosts ?? []) as LumaPerson[]).map((h) => lumaGuest(h, "Host"));
  const guests = ((data.featured_guests ?? []) as LumaPerson[]).map((g) => lumaGuest(g));
  return { name: data.event.name, description: proseText(data.description_mirror), date: data.event.start_at, guests: [...hosts, ...guests] };
}

function lumaGuest(p: LumaPerson, role?: string): Guest {
  const links = [
    p.linkedin_handle && `https://linkedin.com${p.linkedin_handle.startsWith("/") ? "" : "/in/"}${p.linkedin_handle}`,
    p.twitter_handle && `https://x.com/${p.twitter_handle.replace(/^@/, "")}`,
    p.website,
  ]
    .filter((l): l is string => Boolean(l?.trim()))
    .map(normalizeLink);
  const headline = [role, p.bio_short].filter(Boolean).join(" · ") || undefined;
  return { name: p.name, headline, photoUrl: p.avatar_url, links };
}

/** Luma stores descriptions as a ProseMirror doc; we just want the words. */
function proseText(node: unknown): string | undefined {
  const parts: string[] = [];
  const walk = (n: { text?: string; content?: unknown[]; type?: string }) => {
    if (n.text) parts.push(n.text);
    n.content?.forEach((c) => walk(c as typeof n));
    if (n.type === "paragraph") parts.push("\n");
  };
  if (node && typeof node === "object") walk(node as Parameters<typeof walk>[0]);
  return parts.join("").trim().slice(0, 3000) || undefined;
}

function genericPage(html: string): EventPage {
  const meta = (prop: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i"))?.[1];
  return { name: meta("og:title") ?? html.match(/<title>(.*?)<\/title>/s)?.[1]?.trim(), description: meta("og:description") ?? meta("description"), guests: [] };
}

const ScreenshotGuests = z.object({
  guests: z.array(z.object({ name: z.string(), headline: z.string().optional() })),
});

export async function readScreenshots(images: string[]): Promise<Guest[]> {
  if (!llmAvailable || !images.length) return [];
  const { guests } = await cached("shots", images, () =>
    askJson(ScreenshotGuests, {
      model: "vision",
      prompt:
        "These are screenshots of an event guest list. List every person shown. " +
        "headline = any title, company, or bio text next to their name. Skip UI text and the viewer's own buttons.",
      images,
    }),
  );
  return guests.map((g) => ({ ...g, links: [] }));
}

export const parseGuestList = (text = ""): Guest[] =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      // Links anywhere on the line ("Sam Chen - Founder, linkedin.com/in/sam") become links, not headline.
      const links = line.match(LINK)?.map(normalizeLink) ?? [];
      const text = line.replace(LINK, "").replace(/[\s,|–—-]+$/, "").trim();
      // "Name - headline" or "Name, headline" both work.
      const [name, ...rest] = text.split(/\s+[-–—|]\s+|,\s+/);
      return { name, headline: rest.join(", ") || undefined, links };
    })
    .filter((g) => g.name);

const LINK = /\b(?:https?:\/\/\S+|(?:www\.)?(?:linkedin\.com|x\.com|twitter\.com|github\.com)\/\S+)/gi;

/** Same person from two sources (e.g. Luma + screenshot) keeps the richer entry. */
export function dedupe(guests: Guest[]): Guest[] {
  const byName = new Map<string, Guest>();
  for (const g of guests) {
    const key = g.name.toLowerCase().replace(/\s+/g, " ");
    const prev = byName.get(key);
    byName.set(key, prev ? { ...g, ...prev, headline: prev.headline ?? g.headline, links: [...new Set([...prev.links, ...g.links])] } : g);
  }
  return [...byName.values()];
}
