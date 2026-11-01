// Which spoken asks pop which link card. Pure function: no session, no network.
import type { Link, Profile } from "@larp/shared";
import { expect, test } from "vitest";
import { linksAskedFor } from "../src/modules/linkcards/listener";

const link = (kind: Link["kind"], url: string): Link => ({ kind, label: kind, url });
const profileWith = (...links: Link[]): Profile => ({
  id: "me", name: "A", headline: "", summary: "", skills: [], projects: [], links, status: "ready",
});

const full = profileWith(
  link("github", "https://github.com/a"),
  link("demo", "https://a.app"),
  link("linkedin", "https://linkedin.com/in/a"),
  link("website", "https://a.dev"),
  link("other", "https://instagram.com/a"),
  link("other", "https://x.com/a"),
  link("resume", "https://a.dev/cv.pdf"),
);
const urls = (p: Profile, text: string) => linksAskedFor(p, text).map((l) => l.url);

test.each([
  ["Do you have a demo?", "https://a.app"],
  ["can I try it out somewhere", "https://a.app"],
  ["what's your GitHub", "https://github.com/a"],
  ["are you on LinkedIn", "https://linkedin.com/in/a"],
  ["do you have a website?", "https://a.dev"],
  ["got a portfolio?", "https://a.dev"],
  ["send me your resume", "https://a.dev/cv.pdf"],
  ["what's your insta", "https://instagram.com/a"],
  ["are you on Twitter", "https://x.com/a"],
  ["what's your X handle", "https://x.com/a"],
])("%s -> %s", (text, url) => {
  expect(urls(full, text)).toEqual([url]);
});

test("ignores chatter that isn't an ask", () => {
  for (const text of ["Oh I see it now", "let me try it", "yeah I get it", "that's a big win"]) expect(urls(full, text)).toEqual([]);
});

test("website and portfolio asks match either kind", () => {
  expect(urls(profileWith(link("portfolio", "https://p.io")), "what's your website")).toEqual(["https://p.io"]);
  expect(urls(profileWith(link("website", "https://w.io")), "nice portfolio?")).toEqual(["https://w.io"]);
});

test("falls back to another link when the asked kind is missing", () => {
  const p = profileWith(link("github", "https://github.com/a"), link("website", "https://a.dev"));
  expect(urls(p, "do you have a demo?")).toEqual(["https://a.dev"]);
  expect(urls(p, "what's your LinkedIn")).toEqual(["https://github.com/a"]);
});

test("vague asks show your first link", () => {
  expect(urls(full, "where can I find you online?")).toEqual(["https://github.com/a"]);
  expect(urls(full, "can I find you on Instagram")).toEqual(["https://instagram.com/a"]); // specific wins
});

test("no links, no card", () => {
  expect(urls(profileWith(), "do you have a demo?")).toEqual([]);
  expect(linksAskedFor(null, "do you have a demo?")).toEqual([]);
});
