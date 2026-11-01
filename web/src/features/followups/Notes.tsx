// Chunk 5 · Expandable notes: what you learned, moments worth remembering, and the raw transcript.
import type { Conversation } from "@larp/shared";
import { ChevronDown } from "lucide-react";
import { SectionLabel } from "../../components/ui";

const who = { me: "You", them: "Them", unknown: "·" } as const;
const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function Notes({ learned = [], conversations }: { learned?: string[]; conversations: Conversation[] }) {
  const facts = [...new Set([...learned, ...conversations.flatMap((c) => c.notes?.learned ?? [])])];
  const moments = conversations.flatMap((c) => c.notes?.moments ?? []);
  return (
    <details className="group border-t border-line pt-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-body text-muted">
        Notes and transcript
        <ChevronDown size={18} strokeWidth={1.75} className="transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-8 pt-3">
        <Bullets title="What you learned" items={facts} />
        <Bullets title="Moments" items={moments} />
        {conversations.map((c) => (
          <section key={c.id} className="space-y-3">
            <SectionLabel>Transcript · {time(c.startedAt)}</SectionLabel>
            <ol className="space-y-1.5 border-l border-line pl-4 text-meta">
              {c.transcript.map((u, i) => (
                <li key={i}>
                  <span className="text-muted">{who[u.speaker]} </span>
                  {u.text}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </details>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <SectionLabel>{title}</SectionLabel>
      <ul className="list-disc space-y-1 pl-5 text-body marker:text-muted">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}
