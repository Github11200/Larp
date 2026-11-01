// Chunk 5 · One person to text: what you talked about, who promised what, and the draft to send.
import { api, type Conversation, type FollowUp } from "@larp/shared";
import { BellRing, Check, Copy, Pencil } from "lucide-react";
import { useState } from "react";
import { Button, fieldClass, firstName, Pending, SectionLabel } from "../../components/ui";
import { call } from "../../lib/api";
import { Notes } from "./Notes";
import { isDue, sentence } from "./shared";

export function FollowUpCard({ followUp: f, conversations, onChange }: { followUp: FollowUp; conversations: Conversation[]; onChange: () => void }) {
  const save = async (body: { status?: FollowUp["status"]; draft?: string }) => {
    await call(api.updateFollowUp, { params: { id: f.id }, body });
    onChange();
  };
  const first = firstName(f.personName);

  if (f.status === "done") {
    return (
      <article id={`f-${f.id}`} className="flex items-baseline justify-between gap-4 text-muted">
        <p className="text-[16px]">
          <span className="font-serif text-[1.35rem] text-fg">{f.personName}</span> · sent. Networking legend.
        </p>
        <Button variant="ghost" onClick={() => save({ status: "open" })}>
          Undo
        </Button>
      </article>
    );
  }

  return (
    <article id={`f-${f.id}`} className="scroll-mt-6 space-y-5">
      <header className="space-y-2">
        {isDue(f) && (
          <p className="flex items-center gap-2 text-[14px] font-semibold text-live">
            <BellRing size={16} strokeWidth={2} aria-hidden />
            It's been a week. Don't ghost {first}.
          </p>
        )}
        <h3 className="font-serif text-[1.9rem] leading-[1.05]">{f.personName}</h3>
        {conversations.length > 1 && <p className="text-[13px] text-muted">Talked {conversations.length} times</p>}
      </header>
      {f.notesStatus === "pending" && <Pending>Writing up what happened…</Pending>}
      {f.summary && <p className="text-[16px] leading-relaxed text-pretty">{f.summary}</p>}
      <Promises title="You promised" items={f.promises} />
      <Promises title={`${first} said they'd`} items={f.theirPromises} />
      <Draft key={f.draft} draft={f.draft} onSave={(draft) => save({ draft })} />
      <Button className="w-full" onClick={() => save({ status: "done" })}>
        <Check size={18} strokeWidth={2} aria-hidden />
        Mark sent
      </Button>
      <Notes learned={f.learned} conversations={conversations} />
    </article>
  );
}

function Promises({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <SectionLabel>{title}</SectionLabel>
      <ul className="divide-y divide-line border-y border-line">
        {items.map((p) => (
          <li key={p} className="py-2.5 text-[16px]">
            {sentence(p)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The drafted text: read it, tweak it, copy it. */
function Draft({ draft, onSave }: { draft: string; onSave: (draft: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setEditing(true); // no clipboard (http, old browser): let them select it by hand
    }
  };
  const done = async () => {
    if (text !== draft) await onSave(text);
    setEditing(false);
  };

  return (
    <section className="space-y-3">
      <SectionLabel>The text to send</SectionLabel>
      <div className="space-y-3 border border-line bg-surface p-4">
        {editing ? (
          <textarea
            aria-label="Draft message"
            className={`${fieldClass} min-h-40 resize-y border-fg leading-relaxed`}
            value={text}
            onChange={(e) => (setText(e.target.value), setCopied(false))}
            autoFocus
          />
        ) : (
          <p className="text-[16px] leading-relaxed whitespace-pre-line">{text}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={editing ? done : () => setEditing(true)}>
            {editing ? <Check size={18} aria-hidden /> : <Pencil size={16} strokeWidth={1.75} aria-hidden />}
            {editing ? "Save" : "Edit"}
          </Button>
          <Button variant="secondary" onClick={copy}>
            {copied ? <Check size={18} aria-hidden /> : <Copy size={16} strokeWidth={1.75} aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </section>
  );
}
