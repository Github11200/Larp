// Chunk 6 · Last setup step: pick who you want to meet, their dossiers start building, go live.
import { api, type Event, type Person } from "@larp/shared";
import { Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Avatar, Button, Pending, Title } from "../../components/ui";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { SetupFrame } from "./SetupFrame";

/** Top picks come pre-selected so the fastest path is one tap. */
const PRESELECT = 3;

export function PeoplePicker() {
  const events = useApi(api.listEvents, undefined, (es) => es.some((e) => e.status === "pending"));
  const event = events.data?.at(-1);
  if (!event) {
    return (
      <SetupFrame step="people" back={paths.setup("event")}>
        <Title sub={events.loading ? undefined : "No event yet. Go back a step and add one."}>Who's worth meeting</Title>
      </SetupFrame>
    );
  }
  // Remount when prep finishes so the people list re-fetches.
  return <Picker key={`${event.id}:${event.status}`} event={event} />;
}

function Picker({ event }: { event: Event }) {
  const people = useApi(api.listPeople, { id: event.id });
  const list = people.data ?? [];

  const [picked, setPicked] = useState<Set<string>>();
  const chosen = picked ?? new Set(list.slice(0, PRESELECT).map((p) => p.id));
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (!next.delete(id)) next.add(id);
    setPicked(next);
  };

  const navigate = useNavigate();
  const finish = (to: string) => {
    // Fire and forget: dossiers build on the worker while you walk over to say hi.
    for (const id of chosen) void call(api.requestDossier, { params: { id } }).catch(() => {});
    navigate(to);
  };

  return (
    <SetupFrame
      step="people"
      back={paths.setup("event")}
      actions={
        <>
          <Button onClick={() => finish(paths.live([...chosen][0]))}>
            Go live{chosen.size ? ` with ${chosen.size} dossier${chosen.size > 1 ? "s" : ""} cooking` : ""}
          </Button>
          <Button variant="secondary" onClick={() => finish(paths.home())}>
            Read the dossiers first
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Title sub="Ranked by how much you have in common. We'll build a dossier on each one you pick.">
          Who's worth it at {event.name}
        </Title>
        {event.status === "pending" && <Pending>Scouting the guest list (reading bios so you don't have to)…</Pending>}
        {event.status === "error" && <p className="text-danger">Couldn't prep this event. Go back and paste the guest list instead.</p>}
        <ul className="divide-y divide-line border-y border-line">
          {list.map((p) => (
            <li key={p.id}>
              <PickRow person={p} on={chosen.has(p.id)} onToggle={() => toggle(p.id)} />
            </li>
          ))}
        </ul>
      </div>
    </SetupFrame>
  );
}

function PickRow({ person: p, on, onToggle }: { person: Person; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} className="flex w-full items-start gap-3 py-4 text-left">
      <Avatar name={p.name} photoUrl={p.photoUrl} />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{p.name}</span>
        {p.headline && <span className="block truncate text-[14px] text-muted">{p.headline}</span>}
        {p.why && <span className="mt-1 block text-[14px] leading-snug text-fg/85">{p.why}</span>}
      </span>
      <span className={`mt-1 grid size-6 shrink-0 place-items-center border ${on ? "border-fg bg-fg text-bg" : "border-line"}`} aria-hidden>
        {on && <Check size={16} strokeWidth={2.5} />}
      </span>
    </button>
  );
}
