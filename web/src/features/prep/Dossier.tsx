// A person's dossier and links, shown on both the per-event person screen and the contact timeline.
import { api, type Dossier, type Person } from "@larp/shared";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Button, Notice, Pending, Quote, SectionLabel } from "../../components/ui";
import { call } from "../../lib/api";
import { friendlyError, hostOf, hrefOf } from "./format";

export function Links({ links }: { links: string[] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a key={l} href={hrefOf(l)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 border border-line px-3 text-[14px] text-muted active:bg-raise">
          {hostOf(l)}
          <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
        </a>
      ))}
    </div>
  );
}

export function DossierBody({ dossier: d }: { dossier: Dossier }) {
  return (
    <div className="space-y-8">
      <p className="text-[16px] leading-relaxed text-muted text-pretty">{d.summary}</p>
      {d.openers.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>Say this</SectionLabel>
          <ul className="space-y-4 border-l border-line pl-5">
            {d.openers.map((o) => (
              <li key={o}>
                <Quote>{o}</Quote>
              </li>
            ))}
          </ul>
        </section>
      )}
      <List title="Working on" items={d.workingOn} />
      <List title="Common ground" items={d.commonGround} />
      <List title="Into" items={d.interests} />
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <SectionLabel>{title}</SectionLabel>
      <ul className="divide-y divide-line border-y border-line">
        {items.map((i) => (
          <li key={i} className="py-2.5 text-[16px]">
            {i}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Dossier, or the button to build one; ready ones can be rewritten from scratch. */
export function DossierSection({ person: p, onChanged }: { person: Person; onChanged: () => void }) {
  const [error, setError] = useState<string>();
  const build = (fresh: boolean) =>
    call(api.requestDossier, { params: { id: p.id }, body: fresh ? { fresh } : undefined })
      .then(() => (setError(undefined), onChanged()))
      .catch((e) => setError(friendlyError(e)));

  if (!p.dossier) {
    if (p.dossierStatus === "pending") return <Pending>Stalking (professionally)…</Pending>;
    return (
      <div className="space-y-4 border border-dashed border-line p-5">
        {p.dossierStatus === "error" ? (
          <Notice>Research failed. The internet got shy.</Notice>
        ) : (
          <p className="text-[15px] leading-relaxed text-muted text-pretty">
            No dossier yet. We'll dig up what they're working on, what you have in common, and lines to open with.
          </p>
        )}
        {error && <Notice>{error}</Notice>}
        <Button variant="secondary" className="w-full" onClick={() => void build(false)}>
          {p.dossierStatus === "error" ? "Try again" : "Build dossier"}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {p.dossierStatus === "pending" && <Pending>Rewriting the file…</Pending>}
      {p.dossierStatus === "error" && <Notice>The rewrite flopped. Here's the old one.</Notice>}
      <DossierBody dossier={p.dossier} />
      {error && <Notice>{error}</Notice>}
      {p.dossierStatus !== "pending" && (
        <Button variant="ghost" className="w-full" onClick={() => void build(true)}>
          Not feeling it? Rewrite the dossier
        </Button>
      )}
    </div>
  );
}
