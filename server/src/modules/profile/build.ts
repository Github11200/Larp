// Chunk 3 · Turn resume + links into a Profile. Runs as a background job.
import type { LinkKind } from "@larp/shared";
import { db } from "../../lib/db";

export async function buildProfile(input: { userId: string; resumeText?: string; urls: string[] }): Promise<void> {
  // TODO(chunk 3): fetch the URLs, then askJson(<profile schema>, { model: "smart", ... }).
  // Stub: keep what's there and store the URLs as links so link cards have something to show.
  await db.profiles.update(input.userId, "me", (p) => ({
    ...p,
    links: [...p.links, ...input.urls.map((url) => ({ kind: guessKind(url), label: url, url }))],
    status: "ready",
  }));
}

const guessKind = (url: string): LinkKind =>
  url.includes("github.com") ? "github" : url.includes("linkedin.com") ? "linkedin" : "website";
