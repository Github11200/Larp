// A person's header, dossier and links, shown on both the per-event person screen and the contact timeline.
import { api, type Dossier, type Person } from "@larp/shared";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar, Button, Menu, Notice, Pending, Quote, SectionLabel } from "../../components/ui";
import { call } from "../../lib/api";
import { friendlyError, hostOf, hrefOf } from "./format";

/** Photo, name, one line on who they are. Same top on the person and contact screens. */
export function PersonHeader({ name, photoUrl, headline, children }: { name: string; photoUrl?: string; headline?: string; children?: ReactNode }) {
  return (
    <header className="flex items-center gap-4">
      <Avatar name={name} photoUrl={photoUrl} size="lg" />
      <div className="min-w-0 space-y-1">
        <h1 className="text-display text-balance">{name}</h1>
        {headline && <p className="text-body text-muted">{headline}</p>}
        {children}
      </div>
    </header>
  );
}

export function Links({ links }: { links: string[] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a key={l} href={hrefOf(l)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 border border-line px-3 text-meta text-muted active:bg-raise">
          {hostOf(l)}
          <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
        </a>
      ))}
    </div>
  );
}

/** Short tags (skills, shared interests): scannable at a glance instead of a long ruled list. */
export function Chips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span key={s} className="border border-line px-2.5 py-1 text-meta">
          {s}
        </span>
      ))}
    </span>
  );
}

/** What you need walking up: two lines to open with and what you share. The rest is one tap away. */
export function DossierBody({ dossier: d, links = [] }: { dossier: Dossier; links?: string[] }) {
  const hasMore = d.summary || d.workingOn.length || d.interests.length || d.openers.length > 2 || links.length;
  return (
    <div className="space-y-8">
      {d.openers.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>Say this</SectionLabel>
          <ul className="space-y-4 border-l border-line pl-5">
            {d.openers.slice(0, 2).map((o) => (
              <li key={o}>
                <Quote>{o}</Quote>
              </li>
            ))}
          </ul>
        </section>
      )}
      {d.commonGround.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>In common</SectionLabel>
          <ul className="list-disc space-y-1 pl-5 text-body marker:text-muted">
            {d.commonGround.slice(0, 3).map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      )}
      {hasMore && (
        <details className="group border-t border-line pt-3 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-body text-muted">
            The full file
            <ChevronDown size={18} strokeWidth={1.75} className="transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-8 pt-4">
            {d.summary && <p className="text-body text-pretty">{d.summary}</p>}
            <BulletSection title="Working on" items={d.workingOn} />
            <ChipSection title="Into" items={d.interests} />
            <BulletSection title="More openers" items={d.openers.slice(2)} />
            <Links links={links} />
          </div>
        </details>
      )}
    </div>
  );
}

function BulletSection({ title, items }: { title: string; items: string[] }) {
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

function ChipSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <SectionLabel>{title}</SectionLabel>
      <Chips items={items} />
    </section>
  );
}

/** Ask for a dossier (or a fresh rewrite). Opening someone with no dossier starts one, so there's no extra step. */
export function useDossierBuild(p: Person | undefined, onChanged: () => void) {
  const [error, setError] = useState<string>();
  const build = (fresh: boolean) =>
    p &&
    call(api.requestDossier, { params: { id: p.id }, body: fresh ? { fresh } : undefined })
      .then(() => (setError(undefined), onChanged()))
      .catch((e) => setError(friendlyError(e)));
  const started = useRef<string>(undefined);
  useEffect(() => {
    if (!p || p.dossierStatus !== "none" || started.current === p.id) return;
    started.current = p.id;
    void build(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, p?.dossierStatus]);
  return { build, error };
}

type Build = ReturnType<typeof useDossierBuild>;

/** Rewriting a ready dossier is rare, so it lives in the ⋯ menu. */
export function DossierMenu({ person: p, build }: { person: Person; build: Build["build"] }) {
  if (!p.dossier || p.dossierStatus === "pending") return null;
  return <Menu items={[{ label: "Rewrite the dossier", onSelect: () => void build(true) }]} />;
}

/** Dossier, or where it's at. Only a failed build needs a button. */
export function DossierSection({ person: p, build, error }: { person: Person } & Build) {
  if (!p.dossier) {
    if (p.dossierStatus !== "error") return <Pending>Stalking (professionally)…</Pending>;
    return (
      <div className="space-y-3">
        <Notice>Research failed. The internet got shy.</Notice>
        {error && <Notice>{error}</Notice>}
        <Button variant="secondary" className="w-full" onClick={() => void build(false)}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {p.dossierStatus === "pending" && <Pending>Rewriting the file…</Pending>}
      {p.dossierStatus === "error" && <Notice>The rewrite flopped. Here's the old one.</Notice>}
      {error && <Notice>{error}</Notice>}
      <DossierBody dossier={p.dossier} links={p.links} />
    </div>
  );
}
