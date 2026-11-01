// Chunk 3 · Who you are: feed it a resume + links, then fix anything it got wrong, all on one screen.
import { api, type Profile } from "@larp/shared";
import { useEffect, useState } from "react";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { BuildForm } from "./BuildForm";
import { ProfileCard } from "./ProfileCard";

export function ProfilePage() {
  const profile = useApi(api.getProfile, undefined, (p) => p?.status === "pending");
  const p = profile.data;
  const hasContent = Boolean(p && (p.name || p.links.length));

  const save = async (patch: Partial<Profile>) => {
    if (!p) return;
    await call(api.putProfile, { body: { ...p, ...patch } });
    void profile.reload();
  };

  if (p?.status === "pending") return <Learning />;

  if (!hasContent || !p) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Who are you?</h1>
          <p className="text-muted">Feed me your resume and links. I'll make you sound like you did your homework.</p>
        </div>
        {p?.status === "error" && <p className="text-danger">That flopped. Try again?</p>}
        <BuildForm cta="Learn me" onStarted={() => void profile.reload()} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {p.status === "error" && <p className="text-danger">Rebuild flopped. Your old profile is still here.</p>}
      <ProfileCard profile={p} onSave={save} />
      <details className="rounded-lg border border-white/10 p-3">
        <summary className="cursor-pointer text-sm text-muted">Add more about you</summary>
        <div className="pt-3">
          <BuildForm cta="Learn me again" onStarted={() => void profile.reload()} />
        </div>
      </details>
    </div>
  );
}

const LINES = [
  "Stalking your GitHub…",
  "Skimming your resume like a recruiter (6 seconds)…",
  "Googling you, respectfully…",
  "Inventing your personal brand…",
  "Learning to larp as you…",
];

function Learning() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <div className="size-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      <p className="text-lg text-accent">{LINES[i]}</p>
    </div>
  );
}
