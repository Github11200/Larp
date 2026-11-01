// Chunk 3 · Who you are: feed it a resume + links, then fix anything it got wrong, all on one screen.
import { api, type Profile } from "@larp/shared";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Notice, Pending, Title } from "../../components/ui";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { BuildForm } from "./BuildForm";
import { ProfileCard } from "./ProfileCard";

export function ProfilePage() {
  const profile = useApi(api.getProfile, undefined, (p) => p?.status === "pending");
  const { p, save } = useOptimisticSave(profile.data, profile.reload);
  const hasContent = Boolean(p && (p.name || p.links.length));

  if (p?.status === "pending") return <Learning />;

  if (!hasContent || !p) {
    return (
      <div className="space-y-8">
        <Title sub="Resume and links. I'll do the homework.">Who are you?</Title>
        {p?.status === "error" && <Notice>That flopped. Try again?</Notice>}
        <BuildForm cta="Learn me" onStarted={() => void profile.reload()} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {p.status === "error" && <Notice>Rebuild flopped. Your old profile is still here.</Notice>}
      <ProfileCard profile={p} onSave={save} />
      <details className="group border-t border-line">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
          <span className="text-body font-semibold">Add more about you</span>
          <ChevronDown size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="pt-3 pb-2">
          <BuildForm cta="Learn me again" onStarted={() => void profile.reload()} />
        </div>
      </details>
    </div>
  );
}

/** Edits show instantly and save in order, each on top of the last, so quick edits never undo each other. */
function useOptimisticSave(server: Profile | null | undefined, reload: () => Promise<unknown>) {
  const [draft, setDraft] = useState(server);
  const latest = useRef(server);
  const pending = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // Take the server's copy only when none of our edits are still on the way.
  useEffect(() => {
    if (pending.current) return;
    latest.current = server;
    setDraft(server);
  }, [server]);

  const save = (patch: Partial<Profile>) => {
    if (!latest.current) return;
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
    pending.current++;
    queue.current = queue.current
      .then(() => call(api.putProfile, { body: next }))
      .catch((e) => console.error("[profile save]", e))
      .finally(() => --pending.current || void reload());
  };

  return { p: draft, save };
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
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-6 text-center">
      <Pending>Learning you</Pending>
      <p key={i} aria-hidden className="max-w-[18ch] animate-hand-in text-display text-balance">
        {LINES[i]}
      </p>
    </div>
  );
}
