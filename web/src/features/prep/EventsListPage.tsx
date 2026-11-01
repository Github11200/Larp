// Chunk 4 · Every event you've prepped: coming up vs. been there. Tap one to switch to it.
import { api, type Event } from "@larp/shared";
import { ChevronRight, Plus } from "lucide-react";
import { Link } from "react-router";
import { ButtonLink, Notice, Pending, SectionLabel, Title } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { formatWhen, friendlyError } from "./format";

const when = (e: Event) => (e.date ? new Date(e.date).getTime() : (e.createdAt ?? 0));

export function EventsListPage() {
  const events = useApi(api.listEvents, undefined, (es) => es.some((e) => e.status === "pending"));
  if (events.loading) return <Pending>Flipping through your calendar…</Pending>;
  if (events.error) return <Notice>{friendlyError(events.error)}</Notice>;

  const list = events.data ?? [];
  const newest = list.at(-1)?.id;
  const today = new Date().setHours(0, 0, 0, 0);
  const upcoming = list.filter((e) => when(e) >= today).sort((a, b) => when(a) - when(b));
  const past = list.filter((e) => when(e) < today).sort((a, b) => when(b) - when(a));

  return (
    <div className="space-y-8">
      <Title sub="Live mode preps you for the newest one. Tap any event to see its people.">Your events</Title>
      <ButtonLink to={paths.newEvent()} variant="secondary" className="w-full">
        <Plus size={18} strokeWidth={1.75} aria-hidden />
        New event
      </ButtonLink>
      {!list.length && <p className="text-[15px] text-muted">No events yet. Your social calendar is a blank canvas.</p>}
      <EventList title="Coming up" events={upcoming} newest={newest} />
      <EventList title="Been there" events={past} newest={newest} />
    </div>
  );
}

function EventList({ title, events, newest }: { title: string; events: Event[]; newest?: string }) {
  if (!events.length) return null;
  return (
    <section className="space-y-2">
      <SectionLabel>{title}</SectionLabel>
      <ul className="divide-y divide-line border-y border-line">
        {events.map((e) => (
          <li key={e.id}>
            <Link to={paths.event(e.id)} className="flex items-center gap-3 py-4 active:bg-raise">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-[1.35rem] leading-tight">{e.name}</span>
                <span className="mt-0.5 block text-[14px] text-muted">
                  {[e.date ? formatWhen(e.date) : e.createdAt && `Added ${formatWhen(e.createdAt)}`, statusLine(e), e.id === newest && "current"]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const statusLine = (e: Event) => (e.status === "pending" ? "scouting…" : e.status === "error" ? "couldn't prep" : undefined);
