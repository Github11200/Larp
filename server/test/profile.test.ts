// Profile build without an LLM key: GitHub + typed links must still yield a usable profile.
import { afterEach, expect, test, vi } from "vitest";
import { db } from "../src/lib/db";
import { seedDemo } from "../src/lib/seed";
import { buildProfile, mergeProfile } from "../src/modules/profile/build";

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

test("a rebuild adds to the profile instead of wiping it", async () => {
  vi.stubGlobal("fetch", async () => new Response("<title>Blog</title><p>posts</p>", { headers: { "content-type": "text/html" } }));
  await db.profiles.put("u-keep", {
    id: "me",
    name: "Grace Hopper",
    headline: "Compiler pioneer",
    summary: "Wrote the first compiler.",
    skills: ["COBOL"],
    projects: [{ name: "A-0", description: "First compiler" }],
    links: [{ kind: "github", label: "GitHub", url: "https://github.com/grace" }],
    status: "pending",
  });

  await buildProfile({ userId: "u-keep", urls: ["grace.dev"] }); // no LLM, so extraction comes back nearly empty

  const p = await db.profiles.get("u-keep", "me");
  expect(p?.status).toBe("ready");
  expect(p?.name).toBe("Grace Hopper");
  expect(p?.headline).toBe("Compiler pioneer");
  expect(p?.skills).toEqual(["COBOL"]);
  expect(p?.projects.map((x) => x.name)).toEqual(["A-0"]);
  expect(p?.links.map((l) => l.url)).toEqual(["https://github.com/grace", "https://grace.dev/"]);
});

test("mergeProfile keeps filled fields and unions lists", () => {
  const before = { id: "me" as const, name: "Ada", headline: "Old", summary: "S", skills: ["Rust", "C"], projects: [{ name: "Engine", description: "old" }], links: [], status: "ready" as const };
  const merged = mergeProfile(before, {
    name: "",
    headline: "New headline",
    summary: " ",
    skills: ["rust", "Go"],
    projects: [{ name: "engine", description: "new" }, { name: "Loom", description: "weaving" }],
    links: [],
  });
  expect(merged.name).toBe("Ada");
  expect(merged.headline).toBe("New headline");
  expect(merged.summary).toBe("S");
  expect(merged.skills).toEqual(["rust", "Go", "C"]);
  expect(merged.projects.map((x) => x.description)).toEqual(["new", "weaving"]);
});

test("demo shortcut never overwrites a real profile", async () => {
  await db.profiles.put("u-real", { id: "me", name: "Real Me", headline: "", summary: "", skills: [], projects: [], links: [], status: "ready" });
  await seedDemo("u-real");
  expect((await db.profiles.get("u-real", "me"))?.name).toBe("Real Me");
  expect(await db.events.list("u-real")).not.toHaveLength(0);

  await seedDemo("u-fresh");
  expect((await db.profiles.get("u-fresh", "me"))?.name).toBe("Alex Rivera");
});
