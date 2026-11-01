// Chunk 3 · Read what the user's links say about them. GitHub via its API (structured, no scraping);
// LinkedIn blocks bots, so it's kept as a link only; anything else is fetched and reduced to text.

export interface GithubUser {
  login: string;
  name?: string;
  bio?: string;
  repos: { name: string; description?: string; url: string; language?: string; stars: number }[];
}

export interface Sources {
  /** Plain-text snippets, one per URL, for the LLM. */
  texts: { url: string; text: string }[];
  /** Structured GitHub data, also used by the no-LLM fallback. */
  github?: GithubUser;
}

const MAX_CHARS = 4000;
const TIMEOUT_MS = 8000;

export async function readSources(urls: string[]): Promise<Sources> {
  const results = await Promise.all(urls.map((url) => readOne(url).catch(() => undefined)));
  return {
    texts: results.flatMap((r, i) => (r ? [{ url: urls[i], text: r.text }] : [])),
    github: results.find((r) => r?.github)?.github,
  };
}

async function readOne(url: string): Promise<{ text: string; github?: GithubUser } | undefined> {
  const u = new URL(url);
  if (u.hostname.endsWith("linkedin.com")) return undefined;
  if (u.hostname === "github.com") {
    const [owner, repo] = u.pathname.split("/").filter(Boolean);
    if (owner && repo) return { text: await githubRepoText(owner, repo) };
    if (owner) {
      const github = await githubUser(owner);
      return { github, text: JSON.stringify(github) };
    }
    return undefined;
  }
  return { text: await pageText(url) };
}

async function githubUser(login: string): Promise<GithubUser> {
  const [user, repos] = await Promise.all([
    getJson<{ login: string; name: string | null; bio: string | null }>(`https://api.github.com/users/${login}`),
    getJson<RawRepo[]>(`https://api.github.com/users/${login}/repos?sort=pushed&per_page=30`),
  ]);
  return {
    login: user.login,
    name: user.name ?? undefined,
    bio: user.bio ?? undefined,
    repos: repos
      .filter((r) => !r.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 8)
      .map((r) => ({
        name: r.name,
        description: r.description ?? undefined,
        url: r.homepage || r.html_url,
        language: r.language ?? undefined,
        stars: r.stargazers_count,
      })),
  };
}

interface RawRepo {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
}

async function githubRepoText(owner: string, repo: string): Promise<string> {
  const res = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: { accept: "application/vnd.github.raw+json" },
  });
  return `GitHub repo ${owner}/${repo}. README:\n${(await res.text()).slice(0, MAX_CHARS)}`;
}

async function pageText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, { headers: { "user-agent": "Mozilla/5.0 (larp profile builder)" } });
  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  const meta = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "";
  return [title, meta, htmlToText(html)].filter(Boolean).join("\n").slice(0, MAX_CHARS);
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function getJson<T>(url: string): Promise<T> {
  return (await (await fetchWithTimeout(url, { headers: { accept: "application/vnd.github+json" } })).json()) as T;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}
