// Chunk 4 · Every event you've prepped: coming up vs. been there. Tap one to open its hub.
import { api, type Event } from "@larp/shared";
import { Plus } from "lucide-react";
import { ButtonLink, Notice, Pending, Pill, Row, Rows, SectionLabel, Title } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { whenLabel } from "../event/journey";
import { friendlyError } from "./format";

const when = (e: Event) => (e.date ? new Date(e.date).getTime() : (e.createdAt ?? 0));

export function EventsListPage() {
  const events = useApi(api.listEvents, undefined, (es) => es.some((e) => e.status === "pending"));
  if (events.loading) return <Pending>Flipping through your calendar…</Pending>;
  if (events.error) return <Notice>{friendlyError(events.error)}</Notice>;

  const list = events.data ?? [];
  const today = new Date().setHours(0, 0, 0, 0);
  const upcoming = list.filter((e) => when(e) >= today).sort((a, b) => when(a) - when(b));
  const past = list.filter((e) => when(e) < today).sort((a, b) => when(b) - when(a));

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <Title>Events</Title>
        <ButtonLink to={paths.newEvent()} variant="secondary" className="min-h-10 px-3">
          <Plus size={16} strokeWidth={2} aria-hidden />
          New
        </ButtonLink>
      </div>
      {!list.length && <p className="text-body text-muted">No events yet. Your social calendar is a blank canvas.</p>}
      <EventList title="Coming up" events={upcoming} />
      <EventList title="Been there" events={past} />
    </div>
  );
}

function EventList({ title, events }: { title: string; events: Event[] }) {
  if (!events.length) return null;
  return (
    <section className="space-y-2">
      <SectionLabel>{title}</SectionLabel>
      <Rows>
        {events.map((e) => (
          <li key={e.id}>
            <Row
              to={paths.event(e.id)}
              title={<span className="text-title font-normal">{e.name}</span>}
              meta={whenLabel(e) ?? (e.createdAt ? `Added ${new Date(e.createdAt).toLocaleDateString()}` : undefined)}
              trail={statusPill(e)}
            />
          </li>
        ))}
      </Rows>
    </section>
  );
}

function statusPill(e: Event) {
  if (e.status === "pending") return <Pill tone="live">Scouting</Pill>;
  if (e.status === "error") return <Pill>Needs names</Pill>;
  if (whenLabel(e) === "Today") return <Pill tone="live">Today</Pill>;
  return null;
}
