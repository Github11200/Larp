// Chunk 4 · Home: add an event, see who's worth meeting.
import { api, type Event } from "@larp/shared";
import { useState } from "react";
import { Link } from "react-router";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";

export function EventsPage() {
  const events = useApi(api.listEvents, undefined, (es) => es.some((e) => e.status === "pending"));
  const latest = events.data?.at(-1);

  if (events.loading) return <p className="text-muted">Loading…</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{latest ? latest.name : "Who's at your event?"}</h1>
      {latest ? <People event={latest} /> : <AddEvent onAdded={events.reload} />}
    </div>
  );
}

function AddEvent({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [guestList, setGuestList] = useState("");
  const submit = async () => {
    await call(api.createEvent, { body: { url: url || undefined, guestList: guestList || undefined } });
    onAdded();
  };
  const seed = async () => {
    await call(api.seedDemo);
    onAdded();
  };
  return (
    <div className="space-y-3">
      <input className="w-full rounded-lg bg-surface p-3" placeholder="Event link (lu.ma, eventbrite…)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <textarea className="h-28 w-full rounded-lg bg-surface p-3" placeholder="…or paste the guest list, one name per line" value={guestList} onChange={(e) => setGuestList(e.target.value)} />
      <button className="w-full rounded-lg bg-accent p-3 font-semibold text-bg" onClick={submit} disabled={!url && !guestList}>
        Prep me
      </button>
      <button className="w-full p-2 text-sm text-muted underline" onClick={seed}>
        Just show me the demo
      </button>
    </div>
  );
}

function People({ event }: { event: Event }) {
  const people = useApi(api.listPeople, { id: event.id });
  if (event.status === "pending") return <p className="text-muted">Scouting the guest list…</p>;
  return (
    <ul className="space-y-2">
      {people.data?.map((p) => (
        <li key={p.id}>
          <Link to={paths.person(p.id)} className="block rounded-lg bg-surface p-3">
            <div className="font-semibold">{p.name}</div>
            {p.headline && <div className="text-sm text-muted">{p.headline}</div>}
            {p.why && <div className="mt-1 text-sm text-accent">{p.why}</div>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
