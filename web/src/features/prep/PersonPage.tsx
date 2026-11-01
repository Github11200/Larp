// Chunk 4 · One person's dossier + jump into live mode with them.
import { api, type Person } from "@larp/shared";
import { ArrowUpRight, Mic } from "lucide-react";
import { useParams } from "react-router";
import { ActionBar, Avatar, BackLink, Button, ButtonLink, Notice, Pending, SectionLabel, firstName } from "../../components/ui";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";

export function PersonPage() {
  const { id = "" } = useParams();
  const person = useApi(api.getPerson, { id }, (p) => p.dossierStatus === "pending");
  const p = person.data;
  if (!p) return person.error ? <Notice>{person.error}</Notice> : <Pending>Pulling up the file…</Pending>;

  const prep = async () => {
    await call(api.requestDossier, { params: { id } });
    void person.reload();
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-5">
        <BackLink to={paths.home()} label="People" />
        <header className="flex items-center gap-4">
          <Avatar name={p.name} photoUrl={p.photoUrl} size="lg" />
          <div className="min-w-0">
            <h1 className="font-serif text-[2.25rem] leading-[1.05] tracking-[-0.01em] text-balance">{p.name}</h1>
            {p.headline && <p className="mt-1 text-[15px] leading-snug text-muted">{p.headline}</p>}
          </div>
        </header>
        {p.why && <p className="text-[16px] leading-snug text-pretty">{p.why}</p>}
        <Links links={p.links} />
      </div>

      {p.dossier ? <DossierBody dossier={p.dossier} /> : <NoDossier status={p.dossierStatus} onBuild={prep} />}

      <ActionBar>
        <ButtonLink to={paths.live(p.id)}>
          <Mic size={18} strokeWidth={2} aria-hidden />
          Talk to {firstName(p.name)}
        </ButtonLink>
      </ActionBar>
    </div>
  );
}

function Links({ links }: { links: string[] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a key={l} href={l} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 border border-line px-3 text-[14px] text-muted active:bg-raise">
          {new URL(l).hostname.replace(/^www\./, "")}
          <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
        </a>
      ))}
    </div>
  );
}

function DossierBody({ dossier: d }: { dossier: NonNullable<Person["dossier"]> }) {
  return (
    <div className="space-y-8">
      <p className="text-[16px] leading-relaxed text-muted text-pretty">{d.summary}</p>
      {d.openers.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>Say this</SectionLabel>
          <ul className="space-y-4 border-l border-line pl-5">
            {d.openers.map((o) => (
              <li key={o} className="-indent-[0.4em] font-serif text-[1.5rem] leading-[1.2] italic text-pretty">
                “{o}”
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

function NoDossier({ status, onBuild }: { status: Person["dossierStatus"]; onBuild: () => void }) {
  if (status === "pending") return <Pending>Stalking (professionally)…</Pending>;
  return (
    <div className="space-y-4 border border-dashed border-line p-5">
      {status === "error" ? (
        <Notice>Research failed. The internet got shy.</Notice>
      ) : (
        <p className="text-[15px] leading-relaxed text-muted text-pretty">
          No dossier yet. We'll dig up what they're working on, what you have in common, and lines to open with.
        </p>
      )}
      <Button variant="secondary" className="w-full" onClick={onBuild}>
        {status === "error" ? "Try again" : "Build dossier"}
      </Button>
    </div>
  );
}
