// Chunk 4 · Home: add an event, see who's worth meeting.
import { api, type Event, type Person } from "@larp/shared";
import { useState } from "react";
import { Link } from "react-router";
import { Avatar } from "../../components/ui";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { toDataUrl } from "./images";

export function EventsPage() {
  const events = useApi(api.listEvents, undefined, (es) => es.some((e) => e.status === "pending"));
  const [adding, setAdding] = useState(false);
  const latest = events.data?.at(-1);

  if (events.loading) return <p className="text-muted">Loading…</p>;
  if (!latest || adding) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Who's at your event?</h1>
        <AddEvent onAdded={() => (setAdding(false), void events.reload())} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{latest.name}</h1>
          {latest.date && <p className="text-sm text-muted">{new Date(latest.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>}
        </div>
        <button className="shrink-0 text-sm text-muted underline" onClick={() => setAdding(true)}>
          New event
        </button>
      </div>
      {/* Remount when prep finishes so the people list re-fetches. */}
      <People key={`${latest.id}:${latest.status}`} event={latest} />
    </div>
  );
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
    <div className="space-y-3">
      <input className="w-full rounded-lg bg-surface p-3" placeholder="Event link (lu.ma, eventbrite…)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <label className="block cursor-pointer rounded-lg border border-dashed border-muted/40 p-3 text-center text-sm text-muted">
        {screenshots.length ? `📸 ${screenshots.length} screenshot${screenshots.length > 1 ? "s" : ""} of the guest list` : "📸 Add screenshots of the guest list"}
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void pickShots(e.target.files)} />
      </label>
      <textarea
        className="h-24 w-full rounded-lg bg-surface p-3"
        placeholder={"…or paste names, one per line\nSam Chen - Founder, VoiceKit"}
        value={guestList}
        onChange={(e) => setGuestList(e.target.value)}
      />
      <button className="w-full rounded-lg bg-accent p-3 font-semibold text-bg disabled:opacity-40" onClick={submit} disabled={busy || (!url && !guestList && !screenshots.length)}>
        {busy ? "Sending…" : "Prep me"}
      </button>
      <button className="w-full p-2 text-sm text-muted underline" onClick={seed}>
        Just show me the demo
      </button>
    </div>
  );
}

function People({ event }: { event: Event }) {
  const people = useApi(api.listPeople, { id: event.id });
  if (event.status === "pending") return <p className="text-muted">Scouting the guest list… (reading bios so you don't have to)</p>;
  if (event.status === "error") return <p className="text-danger">Couldn't prep this one: {event.error}</p>;
  if (people.data?.length === 0) return <p className="text-muted">Nobody found. Try screenshots of the guest list.</p>;
  return (
    <ul className="space-y-2">
      {people.data?.map((p) => (
        <li key={p.id}>
          <PersonRow person={p} />
        </li>
      ))}
    </ul>
  );
}

function PersonRow({ person: p }: { person: Person }) {
  return (
    <Link to={paths.person(p.id)} className="flex gap-3 rounded-lg bg-surface p-3">
      <Avatar name={p.name} photoUrl={p.photoUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">
            {p.name} {p.dossierStatus === "ready" && <span title="Dossier ready">📁</span>}
          </span>
          {p.score !== undefined && <span className="shrink-0 text-xs font-semibold text-accent">{Math.round(p.score * 100)}% worth it</span>}
        </div>
        {p.headline && <div className="truncate text-sm text-muted">{p.headline}</div>}
        {p.why && <div className="mt-1 text-sm text-accent">{p.why}</div>}
      </div>
    </Link>
  );
}
