// Chunk 3 · Who you are: build from links/resume, review what it learned.
import { api } from "@larp/shared";
import { useState } from "react";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";

export function ProfilePage() {
  const profile = useApi(api.getProfile, undefined, (p) => p?.status === "pending");
  const [urls, setUrls] = useState("");
  const p = profile.data;

  const build = async () => {
    await call(api.buildProfile, { body: { urls: urls.split(/\s+/).filter(Boolean) } });
    setUrls("");
    void profile.reload();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{p?.name || "Who are you?"}</h1>
      {p?.headline && <p className="text-muted">{p.headline}</p>}
      {p?.status === "pending" && <p className="text-accent">Reading up on you…</p>}

      {p && p.links.length > 0 && (
        <ul className="space-y-1">
          {p.links.map((l) => (
            <li key={l.url} className="text-sm">
              <span className="text-muted">{l.kind}</span> {l.url}
            </li>
          ))}
        </ul>
      )}

      {/* TODO(chunk 3): resume upload, edit fields */}
      <div className="space-y-3">
        <textarea className="h-28 w-full rounded-lg bg-surface p-3" placeholder="Your links: GitHub, LinkedIn, demo, portfolio…" value={urls} onChange={(e) => setUrls(e.target.value)} />
        <button className="w-full rounded-lg bg-accent p-3 font-semibold text-bg" onClick={build} disabled={!urls.trim()}>
          Learn me
        </button>
      </div>
    </div>
  );
}
