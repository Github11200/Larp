// Chunk 5 · A conversation with nobody named yet: still worth notes, and one tap from becoming follow-ups.
import { api, type Conversation } from "@larp/shared";
import { useState } from "react";
import { Button, fieldClass, Pending } from "../../components/ui";
import { call } from "../../lib/api";
import { Notes } from "./Notes";

export function NotesCard({ conversation: c, onChange }: { conversation: Conversation; onChange: () => void }) {
  const [names, setNames] = useState("");
  const minutes = Math.max(1, Math.round(((c.endedAt ?? c.startedAt) - c.startedAt) / 60000));

  const label = async (raw: string) => {
    const participants = raw
      .split(/,| and /)
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    if (!participants.length) return;
    await call(api.labelConversation, { params: { id: c.id }, body: { participants } });
    onChange();
  };

  return (
    <article className="space-y-4">
      <header className="space-y-1">
        <h3 className="text-title">Who was this?</h3>
        <p className="text-meta text-muted">
          {minutes} min · {new Date(c.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · a face, no name
        </p>
      </header>
      {c.notes?.status === "pending" && <Pending>Writing up what happened…</Pending>}
      {c.notes?.summary && <p className="text-body text-pretty">{c.notes.summary}</p>}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void label(names);
        }}
      >
        {(c.notes?.namesHeard.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {c.notes!.namesHeard.map((n) => (
              <Button key={n} variant="secondary" className="min-h-10 px-3 text-meta" onClick={() => label(n)}>
                It was {n}
              </Button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input className={fieldClass} placeholder="Name, or names if a group" value={names} onChange={(e) => setNames(e.target.value)} />
          <Button type="submit" disabled={!names.trim()}>
            Save
          </Button>
        </div>
      </form>
      <Notes conversations={[c]} />
    </article>
  );
}
