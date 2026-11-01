// Chunk 6 · Before: the guest list ranked by who's worth your time, each one a tap from their dossier.
import type { Person } from "@larp/shared";
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

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <SectionLabel>Worth meeting, best match first</SectionLabel>
        <Rows>
          {j.people.map((p) => (
            <li key={p.id}>
              <PersonRow person={p} met={j.met.has(p.id)} />
            </li>
          ))}
        </Rows>
      </section>
      <QuickAdd eventId={event.id} onAdded={() => void j.reload()} />
    </div>
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

/** One status per person: met beats dossier beats nothing. */
function PersonPill({ person: p, met }: { person: Person; met: boolean }) {
  if (met) return <Pill tone="done">Met</Pill>;
  if (p.dossierStatus === "ready") return <Pill>Dossier</Pill>;
  if (p.dossierStatus === "pending") return <Pill tone="live">Prepping</Pill>;
  return null;
}
