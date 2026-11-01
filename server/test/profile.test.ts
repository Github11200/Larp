// Profile build without an LLM key: GitHub + typed links must still yield a usable profile.
import { afterEach, expect, test, vi } from "vitest";
import { db } from "../src/lib/db";
import { buildProfile } from "../src/modules/profile/build";

const responses: Record<string, unknown> = {
  "https://api.github.com/users/ada": { login: "ada", name: "Ada Lovelace", bio: "Builds analytical engines" },
  "https://api.github.com/users/ada/repos?sort=pushed&per_page=30": [
    { name: "engine", description: "Difference engine", html_url: "https://github.com/ada/engine", homepage: "https://engine.vercel.app", language: "Rust", stargazers_count: 50, fork: false },
    { name: "forked", description: null, html_url: "https://github.com/ada/forked", homepage: null, language: "C", stargazers_count: 99, fork: true },
  ],
};

afterEach(() => vi.unstubAllGlobals());

test("builds from GitHub and notes with no LLM", async () => {
  vi.stubGlobal("fetch", async (url: string) => {
    if (url in responses) return Response.json(responses[url]);
    return new Response("<title>Ada's site</title><p>hi</p>", { headers: { "content-type": "text/html" } });
  });
  await db.profiles.put("u-ada", { id: "me", name: "", headline: "", summary: "", skills: [], projects: [], links: [], status: "pending" });

  await buildProfile({
    userId: "u-ada",
    urls: ["github.com/ada"],
    notes: "Into chess. Demo: https://engine.vercel.app, LinkedIn linkedin.com/in/ada",
  });

  const p = await db.profiles.get("u-ada", "me");
  expect(p?.status).toBe("ready");
  expect(p?.name).toBe("Ada Lovelace");
  expect(p?.headline).toBe("Builds analytical engines");
  expect(p?.projects.map((x) => x.name)).toEqual(["engine"]);
  expect(p?.links.map((l) => [l.kind, l.url])).toEqual([
    ["github", "https://github.com/ada"],
    ["demo", "https://engine.vercel.app/"],
    ["linkedin", "https://linkedin.com/in/ada"],
  ]);
});
