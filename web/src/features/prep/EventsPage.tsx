// Chunk 4 · Events tab: one event's people ranked by who's worth meeting, plus adding a new event.
import { api, type Event, type Person } from "@larp/shared";
import { CalendarDays, FileCheck2, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Avatar, BackLink, Button, Field, FilePick, Notice, Pending, Title, fieldClass } from "../../components/ui";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { QuickAdd } from "../contacts/QuickAdd";
import { formatWhen, friendlyError } from "./format";
import { toDataUrl } from "./images";

/** `/` shows the newest event, `/events/:id` a specific one. `?new=1` opens the add form. */
export function EventsPage({ inSetup = false }: { inSetup?: boolean }) {
  const { id } = useParams();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const events = useApi(api.listEvents, undefined, (es) => es.some((e) => e.status === "pending"));
  const list = events.data ?? [];
  const event = id ? list.find((e) => e.id === id) : list.at(-1);
  const closeForm = () => setSearch({}, { replace: true });
  const [added, setAdded] = useState(0);

  if (events.loading) return <Pending>Checking your events…</Pending>;
  if (events.error) return <Notice>{friendlyError(events.error)}</Notice>;
  if (id && !event) return <EventGone />;
  if (!event || search.has("new")) {
    return (
      <div className="space-y-6">
        <Title sub="Link, guest list screenshots, or pasted names. Any one works. We'll rank who's worth your time.">
          Who's at your event?
        </Title>
        <AddEvent
          onCancel={event ? closeForm : undefined}
          onAdded={(added) => (id ? navigate(paths.event(added.id)) : (closeForm(), void events.reload()))}
        />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="-mb-2 flex items-center justify-between">
        {inSetup ? (
          <span />
        ) : (
          <Link to={paths.events()} className="-ml-1 inline-flex min-h-10 items-center gap-1.5 text-[15px] text-muted">
            <CalendarDays size={18} strokeWidth={1.75} aria-hidden />
            All events{list.length > 1 ? ` · ${list.length}` : ""}
          </Link>
        )}
        <Button variant="ghost" className="-mr-2" onClick={() => setSearch({ new: "1" })}>
          <Plus size={16} strokeWidth={1.75} aria-hidden />
          New event
        </Button>
      </div>
      <Title sub={event.date && formatWhen(event.date)}>{event.name}</Title>
      {/* Remount when prep finishes (or someone is added) so the people list re-fetches. */}
      <People key={`${event.id}:${event.status}:${added}`} event={event} onRetry={() => void events.reload()} />
      {!inSetup && event.status !== "pending" && (
        <EventFooter
          event={event}
          onChanged={() => void events.reload()}
          onPersonAdded={() => setAdded((n) => n + 1)}
          onDeleted={() => navigate(paths.events())}
        />
      )}
    </div>
  );
}

function EventFooter({
  event,
  onChanged,
  onPersonAdded,
  onDeleted,
}: {
  event: Event;
  onChanged: () => void;
  onPersonAdded: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string>();
  const rename = async () => {
    const name = window.prompt("Call this event…", event.name);
    if (!name?.trim()) return;
    await call(api.updateEvent, { params: { id: event.id }, body: { name } }).then(onChanged, (e) => setError(friendlyError(e)));
  };
  const remove = async () => {
    if (!window.confirm(`Delete "${event.name}" and its guest list? People you've talked to stay in People.`)) return;
    await call(api.deleteEvent, { params: { id: event.id } }).then(onDeleted, (e) => setError(friendlyError(e)));
  };
  return (
    <div className="space-y-4 pt-4">
      {event.status === "ready" && <QuickAdd eventId={event.id} onAdded={onPersonAdded} />}
      {error && <Notice>{error}</Notice>}
      <div className="flex justify-center gap-4">
        <Button variant="ghost" onClick={() => void rename()}>
          Rename
        </Button>
        <Button variant="ghost" onClick={() => void remove()}>
          Delete event
        </Button>
      </div>
    </div>
  );
}

function EventGone() {
  return (
    <div className="space-y-4">
      <BackLink to={paths.events()} label="All events" />
      <p className="font-serif text-[2rem] leading-tight">This event has left the building.</p>
      <p className="text-[15px] text-muted text-pretty">It was deleted, or the link is from another phone.</p>
    </div>
  );
}

function AddEvent({ onAdded, onCancel }: { onAdded: (e: Event) => void; onCancel?: () => void }) {
  const [url, setUrl] = useState("");
  const [guestList, setGuestList] = useState("");
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const pickShots = async (files: FileList | null) => setScreenshots(await Promise.all([...(files ?? [])].map(toDataUrl)));
  const run = async (work: () => Promise<Event>) => {
    setBusy(true);
    setError(undefined);
    try {
      onAdded(await work());
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = () =>
    run(() =>
      call(api.createEvent, {
        body: { url: url || undefined, guestList: guestList || undefined, screenshots: screenshots.length ? screenshots : undefined },
      }),
    );
  const seed = () =>
    run(async () => {
      await call(api.seedDemo);
      return (await call(api.listEvents)).at(-1)!;
    });

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <Field label="Event link">
          <input
            type="url"
            inputMode="url"
            className={fieldClass}
            placeholder="lu.ma/…, eventbrite, whatever"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <Field label="Guest list screenshots">
          <FilePick
            label="Add screenshots of the guest list"
            picked={screenshots.length ? `${screenshots.length} screenshot${screenshots.length > 1 ? "s" : ""} of the guest list` : undefined}
            accept="image/*"
            multiple
            icon="image"
            onPick={(files) => void pickShots(files)}
          />
        </Field>
        <Field label="Or paste names, one per line">
          <textarea
            className={`${fieldClass} h-24 resize-none`}
            placeholder={"Sam Chen - Founder, VoiceKit\nPriya Patel - ML eng"}
            value={guestList}
            onChange={(e) => setGuestList(e.target.value)}
          />
        </Field>
      </div>
      {error && <Notice>{error}</Notice>}
      <div className="flex flex-col gap-2">
        <Button onClick={() => void submit()} disabled={busy || (!url && !guestList && !screenshots.length)}>
          {busy ? "Sending in the scouts…" : "Prep me"}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="ghost" onClick={() => void seed()} disabled={busy}>
          Just show me the demo
        </Button>
      </div>
    </div>
  );
}

function People({ event, onRetry }: { event: Event; onRetry: () => void }) {
  const people = useApi(api.listPeople, { id: event.id });
  if (event.status === "pending") return <Pending>Scouting the guest list (reading bios so you don't have to)…</Pending>;
  if (event.status === "error") {
    return (
      <div className="space-y-5">
        <Notice>{event.error ?? "Couldn't prep this one."}</Notice>
        <AddNames eventId={event.id} onSent={onRetry} />
      </div>
    );
  }
  if (people.loading) return <Pending>Ranking the room…</Pending>;
  if (people.data?.length === 0) {
    return <p className="text-[15px] text-muted text-pretty">Nobody found. Screenshots of the guest list usually work better, tap New event.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-[14px] text-muted">Ranked by how much you have in common. Tap anyone for their dossier.</p>
      <ol className="divide-y divide-line border-y border-line">
        {people.data?.map((p, i) => (
          <li key={p.id}>
            <PersonRow person={p} rank={i + 1} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Rescue a failed event in place: paste the names, keep the event. */
function AddNames({ eventId, onSent }: { eventId: string; onSent: () => void }) {
  const [guestList, setGuestList] = useState("");
  const [error, setError] = useState<string>();
  const send = () =>
    call(api.addGuests, { params: { id: eventId }, body: { guestList } }).then(onSent, (e) => setError(friendlyError(e)));
  return (
    <div className="space-y-3">
      <Field label="Paste the names, one per line">
        <textarea
          className={`${fieldClass} h-28 resize-none`}
          placeholder={"Sam Chen - Founder, VoiceKit\nPriya Patel - ML eng"}
          value={guestList}
          onChange={(e) => setGuestList(e.target.value)}
        />
      </Field>
      {error && <Notice>{error}</Notice>}
      <Button className="w-full" onClick={() => void send()} disabled={!guestList.trim()}>
        Scout these instead
      </Button>
    </div>
  );
}

function PersonRow({ person: p, rank }: { person: Person; rank: number }) {
  return (
    <Link to={paths.person(p.id)} className="flex items-start gap-3 py-4 active:bg-raise">
      <span className="w-5 shrink-0 pt-2 font-serif text-[1.2rem] leading-none text-muted tabular-nums">{rank}</span>
      <Avatar name={p.name} photoUrl={p.photoUrl} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[16px] font-semibold">{p.name}</span>
            {p.dossierStatus === "ready" && (
              <FileCheck2 size={15} strokeWidth={1.75} className="shrink-0 text-muted" aria-label="Dossier ready" role="img" />
            )}
          </span>
          {p.score !== undefined && <span className="shrink-0 text-[13px] text-muted tabular-nums">{Math.round(p.score * 100)}% worth it</span>}
        </span>
        {p.headline && <span className="block truncate text-[14px] text-muted">{p.headline}</span>}
        {p.why && <span className="mt-1 block text-[14px] leading-snug text-fg/85 text-pretty">{p.why}</span>}
      </span>
    </Link>
  );
}
