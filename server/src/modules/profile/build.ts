// Chunk 3 · Turn resume + links + notes into a Profile. Runs as a background job.
// With an LLM: it reads everything and writes the profile. Without one (or if it fails): rule-based
// fallback from GitHub + the links, so the app still works with no keys.
import { Profile, type Link, type LinkKind } from "@larp/shared";
import type { z } from "zod";
import { db } from "../../lib/db";
import { askJson, llmAvailable } from "../../lib/llm";
import { readSources, type Sources } from "./sources";

export interface BuildInput {
  userId: string;
  resumeText?: string;
  urls: string[];
  notes?: string;
}

/** What we ask the LLM for: every editable Profile field. */
const Extracted = Profile.pick({ name: true, headline: true, summary: true, skills: true, projects: true, links: true });
type Extracted = z.infer<typeof Extracted>;

export async function buildProfile(input: BuildInput): Promise<void> {
  const typed = [...input.urls, ...urlsIn(input.notes ?? "")].map(normalizeUrl).filter((u): u is string => Boolean(u));
  const urls = [...new Set(typed)];
  try {
    const sources = await readSources(urls);
    const extracted = await extract({ ...input, urls }, sources);
    await db.profiles.update(input.userId, "me", (p) => ({
      ...p,
      ...extracted,
      // A rebuild never drops or relabels links the user already has; every URL they typed is kept.
      links: mergeLinks(p.links, extracted.links, urls.map(linkFor)),
      status: "ready",
    }));
  } catch (e) {
    console.error("[profile.build]", e);
    await db.profiles.update(input.userId, "me", (p) => ({ ...p, status: "error" }));
  }
}

async function extract(input: BuildInput, sources: Sources): Promise<Extracted> {
  if (llmAvailable) {
    try {
      return await askJson(Extracted, { model: "smart", system: SYSTEM, prompt: prompt(input, sources), maxTokens: 3000 });
    } catch (e) {
      console.error("[profile.build] LLM failed, using fallback", e);
    }
  }
  return fallback(input, sources);
}

const SYSTEM = `You build a networking profile for someone about to walk into an event. Use only facts from their resume, links, and notes. Never use gendered pronouns; use their name or "they".
- name: their full name.
- headline: who they are in under 10 words, e.g. "CS student building voice AI tools".
- summary: 2-3 punchy sentences a stranger would find interesting, including hobbies if mentioned.
- skills: up to 12, most impressive first.
- projects: up to 6 most impressive, each with a one-sentence description and its best URL (demo over repo) if known.
- links: every shareable link (from the list given AND any in the resume). kind is one of demo, github, linkedin, portfolio, website, resume, other. label is short, e.g. "GitHub", "Rally demo".
Return JSON only.`;

function prompt(input: BuildInput, sources: Sources): string {
  const parts = [
    input.resumeText && `## Resume\n${input.resumeText.slice(0, 12000)}`,
    input.notes && `## Notes from them\n${input.notes}`,
    input.urls.length && `## Their links\n${input.urls.join("\n")}`,
    ...sources.texts.map((s) => `## Content of ${s.url}\n${s.text}`),
  ];
  return parts.filter(Boolean).join("\n\n");
}

function fallback(input: BuildInput, { github }: Sources): Extracted {
  const firstLine = input.resumeText?.split("\n").map((l) => l.trim()).find(Boolean);
  return {
    name: github?.name ?? (firstLine && firstLine.length < 40 ? firstLine : ""),
    headline: github?.bio ?? "",
    summary: input.notes?.slice(0, 300) ?? "",
    skills: [...new Set(github?.repos.flatMap((r) => (r.language ? [r.language] : [])) ?? [])],
    projects: github?.repos.slice(0, 6).map((r) => ({ name: r.name, description: r.description ?? "", url: r.url })) ?? [],
    links: [],
  };
}

function mergeLinks(...lists: Link[][]): Link[] {
  const byUrl = new Map<string, Link>();
  for (const link of lists.flat()) {
    const key = link.url.replace(/\/+$/, "").toLowerCase();
    if (!byUrl.has(key)) byUrl.set(key, link);
  }
  return [...byUrl.values()];
}

function linkFor(url: string): Link {
  const kind = guessKind(url);
  const named: Partial<Record<LinkKind, string>> = { github: "GitHub", linkedin: "LinkedIn", demo: "Demo" };
  return { kind, label: named[kind] ?? new URL(url).hostname.replace(/^www\./, ""), url };
}

function guessKind(url: string): LinkKind {
  if (url.includes("github.com")) return "github";
  if (url.includes("linkedin.com")) return "linkedin";
  if (/devpost\.com|youtube\.com|youtu\.be|loom\.com|vercel\.app|onrender\.com/.test(url)) return "demo";
  if (/\.pdf($|\?)/.test(url)) return "resume";
  return "website";
}

const urlsIn = (text: string) =>
  (text.match(/https?:\/\/\S+|\b[\w.-]+\.(?:com|io|dev|app|ai|me|co|org|ca)\b\S*/g) ?? []).map((u) => u.replace(/[),.;]+$/, ""));

/** Accepts "github.com/me" as well as full URLs; drops anything that isn't a URL. */
function normalizeUrl(raw: string): string | undefined {
  try {
    return new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).toString();
  } catch {
    return undefined;
  }
}
