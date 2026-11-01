// Chunk 6 · Before: the guest list ranked by who's worth your time, each one a tap from their dossier.
import type { Person } from "@larp/shared";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, Notice, Pending, Pill, Row, Rows, SectionLabel } from "../../components/ui";
import { paths } from "../../routes";
import { QuickAdd } from "../contacts/QuickAdd";
import { AddNames } from "../prep/EventsPage";
import type { Journey } from "./useEventJourney";

export function PrepStage({ journey: j }: { journey: Journey }) {
  const event = j.event!;
  if (event.status === "pending") return <Pending>Scouting the guest list (reading bios so you don't have to)…</Pending>;
  if (event.status === "error") {
    return (
      <div className="space-y-5">
        <Notice>{event.error ?? "Couldn't read that guest list."}</Notice>
        <AddNames eventId={event.id} onSent={() => void j.reload()} />
      </div>
    );
  }
  if (j.peopleLoading) return <Pending>Ranking the room…</Pending>;
  if (!j.people.length) return <AddNames eventId={event.id} onSent={() => void j.reload()} cta="Scout these" />;

  const { picks, hosts, rest } = groupGuests(j.people);
  const row = (p: Person) => (
    <li key={p.id}>
      <PersonRow person={p} met={j.met.has(p.id)} />
    </li>
  );
  return (
    <div className="space-y-8">
      {picks.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>Your top picks</SectionLabel>
          <Rows>{picks.map(row)}</Rows>
        </section>
      )}
      <Fold title="Hosts" people={hosts} render={row} />
      <Fold title={picks.length ? "Everyone else" : "Guest list"} people={rest} render={row} open={!picks.length} />
      <QuickAdd eventId={event.id} onAdded={() => void j.reload()} />
    </div>
  );
}

/** Hand-picked few up top; hosts and the long tail tucked away. Unranked lists get no "top picks" (they'd be a lie). */
const TOP = 5;
const isHost = (p: Person) => /^host\b/i.test(p.headline ?? "");
function groupGuests(people: Person[]) {
  const ranked = people.some((p) => p.score !== undefined);
  const picks = ranked ? people.filter((p) => p.score !== undefined).slice(0, TOP) : [];
  const others = people.filter((p) => !picks.includes(p));
  return { picks, hosts: others.filter(isHost), rest: others.filter((p) => !isHost(p)) };
}

function Fold({ title, people, render, open }: { title: string; people: Person[]; render: (p: Person) => ReactNode; open?: boolean }) {
  if (!people.length) return null;
  return (
    <details open={open} className="group [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between border-b border-line text-meta font-semibold text-muted">
        {title} · {people.length}
        <ChevronDown size={16} strokeWidth={1.75} className="transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="divide-y divide-line border-b border-line">{people.map(render)}</ul>
    </details>
  );
}

export function PersonRow({ person: p, met }: { person: Person; met: boolean }) {
  return (
    <Row
      to={paths.person(p.id)}
      lead={<Avatar name={p.name} photoUrl={p.photoUrl} />}
      title={p.name}
      meta={p.why ?? p.headline}
      trail={<PersonPill person={p} met={met} />}
    />
  );
}

/** At most one status: met, or a dossier still being written. */
function PersonPill({ person: p, met }: { person: Person; met: boolean }) {
  if (met) return <Pill tone="done">Met</Pill>;
  if (p.dossierStatus === "pending") return <Pill tone="live">Prepping</Pill>;
  return null;
}
