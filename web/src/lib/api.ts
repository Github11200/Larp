// Typed client for the REST contract in @larp/shared. Every feature talks to the server through call().
import { buildPath, LIVE_PATH, USER_HEADER, type BodyIn, type ResOf, type RouteDef } from "@larp/shared";

const API_URL = apiBase(import.meta.env.VITE_API_URL);

/** Empty = same origin (dev proxy). Tolerates a bare host or trailing slash pasted into the Render dashboard. */
function apiBase(raw = ""): string {
  const url = raw.trim().replace(/\/+$/, "");
  return !url || /^https?:\/\//.test(url) ? url : `https://${url}`;
}

/** Anonymous per-device user, so testers don't see each other's data. `?user=demo` overrides it. */
export const userId = (() => {
  const fromUrl = new URLSearchParams(location.search).get("user");
  try {
    if (fromUrl) localStorage.setItem("larp.user", fromUrl);
    const existing = localStorage.getItem("larp.user");
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem("larp.user", id);
    return id;
  } catch {
    return fromUrl ?? "demo";
  }
})();

export async function call<D extends RouteDef>(
  def: D,
  opts: { params?: Record<string, string>; body?: BodyIn<D> } = {},
): Promise<ResOf<D>> {
  const res = await fetch(API_URL + buildPath(def.path, opts.params), {
    method: def.method,
    headers: { "content-type": "application/json", [USER_HEADER]: userId },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  // The static site answers unknown paths with index.html; say what's wrong instead of a JSON parse error.
  if (!res.headers.get("content-type")?.includes("json")) throw new Error(`Can't reach the API (${def.path}). Is VITE_API_URL set?`);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `${res.status} ${def.path}`);
  return def.res.parse(await res.json()) as ResOf<D>;
}

export const liveUrl = () => {
  const http = API_URL || location.origin;
  return `${http.replace(/^http/, "ws")}${LIVE_PATH}?user=${encodeURIComponent(userId)}`;
};
