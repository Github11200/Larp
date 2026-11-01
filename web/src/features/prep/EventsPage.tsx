// Chunk 4 · Home: add an event, see who's worth meeting.
import { api, type Event, type Person } from "@larp/shared";
import { FileCheck2, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Avatar, Button, Field, FilePick, Notice, Pending, Title, fieldClass } from "../../components/ui";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { toDataUrl } from "./images";

export function EventsPage() {
  const events = useApi(api.listEvents, undefined, (es) => es.some((e) => e.status === "pending"));
  const [adding, setAdding] = useState(false);
  const latest = events.data?.at(-1);

  if (events.loading) return <Pending>Checking your events…</Pending>;
  if (!latest || adding) {
    return (
      <div className="space-y-6">
        <Title sub="Link, guest list screenshots, or pasted names. Any one works. We'll rank who's worth your time.">
          Who's at your event?
        </Title>
        <AddEvent onAdded={() => (setAdding(false), void events.reload())} />
        {latest && (
          <Button variant="ghost" className="w-full" onClick={() => setAdding(false)}>
            Never mind, back to {latest.name}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <Title
        sub={
          <span className="flex items-center justify-between gap-3">
            <span>{latest.date && formatWhen(latest.date)}</span>
            <Button variant="ghost" className="-my-2 -mr-2 shrink-0" onClick={() => setAdding(true)}>
              <Plus size={16} strokeWidth={1.75} aria-hidden />
              New event
            </Button>
          </span>
        }
      >
        {latest.name}
      </Title>
      {/* Remount when prep finishes so the people list re-fetches. */}
      <People key={`${latest.id}:${latest.status}`} event={latest} />
    </div>
  );
}

/** Date-only strings are a calendar day, so don't invent a time (or shift it a day by timezone). */
function formatWhen(date: string) {
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(date);
  return new Date(date).toLocaleString(undefined, dayOnly ? { dateStyle: "medium", timeZone: "UTC" } : { dateStyle: "medium", timeStyle: "short" });
}

function AddEvent({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [guestList, setGuestList] = useState("");
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pickShots = async (files: FileList | null) => setScreenshots(await Promise.all([...(files ?? [])].map(toDataUrl)));
  const submit = async () => {
    setBusy(true);
    await call(api.createEvent, {
      body: { url: url || undefined, guestList: guestList || undefined, screenshots: screenshots.length ? screenshots : undefined },
    }).finally(() => setBusy(false));
    onAdded();
  };
  const seed = async () => {
    await call(api.seedDemo);
    onAdded();
  };

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
      <div className="flex flex-col gap-2">
        <Button onClick={submit} disabled={busy || (!url && !guestList && !screenshots.length)}>
          {busy ? "Sending in the scouts…" : "Prep me"}
        </Button>
        <Button variant="ghost" onClick={seed}>
          Just show me the demo
        </Button>
      </div>
    </div>
  );
}

function People({ event }: { event: Event }) {
  const people = useApi(api.listPeople, { id: event.id });
  if (event.status === "pending") return <Pending>Scouting the guest list (reading bios so you don't have to)…</Pending>;
  if (event.status === "error") return <Notice>Couldn't prep this one: {event.error}. Tap New event and paste the names instead.</Notice>;
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
