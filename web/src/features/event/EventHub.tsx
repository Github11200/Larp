// Chunk 6 · One event, start to finish: Prep (who's worth it) -> Live (who you've met) -> Recap (who to text).
// Every other screen hangs off this one, so the app reads as one night out, not five tools.
import { api } from "@larp/shared";
import { Mic } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";
import { ActionBar, BackLink, ButtonLink, Menu, Notice, Pending, Segmented } from "../../components/ui";
import { call } from "../../lib/api";
import { paths, type Stage } from "../../routes";
import { friendlyError } from "../prep/format";
import { isDue } from "../followups/shared";
import { defaultStage, whenLabel } from "./journey";
import { LiveStage } from "./LiveStage";
import { PrepStage } from "./PrepStage";
import { RecapStage } from "./RecapStage";
import { useEventJourney, type Journey } from "./useEventJourney";

const STAGES: Stage[] = ["prep", "live", "recap"];

export function EventHub() {
  const { id = "", stage: urlStage } = useParams<{ id: string; stage?: Stage }>();
  const j = useEventJourney(id);
  const navigate = useNavigate();

  if (j.loading) return <Pending>Checking your events…</Pending>;
  if (j.events.error) return <Notice>{friendlyError(j.events.error)}</Notice>;
  if (!j.event) return <EventGone />;
  if (urlStage && !STAGES.includes(urlStage)) return <Navigate to={paths.event(id)} replace />;

  const event = j.event;
  const stage = urlStage ?? defaultStage(event, j.chats);
  const due = j.followUps.filter(isDue).length;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <BackLink to={paths.events()} label="Events" />
        <EventMenu journey={j} onDeleted={() => navigate(paths.events())} />
      </div>
      <header className="space-y-1.5">
        <h1 className="text-display text-balance">{event.name}</h1>
        <p className="text-body text-muted">{[whenLabel(event), progress(j)].filter(Boolean).join(" · ")}</p>
      </header>
      <Segmented
        label="Stage"
        value={stage}
        onChange={(s) => navigate(paths.event(id, s), { replace: true })}
        options={[
          { key: "prep", label: "1 · Prep" },
          { key: "live", label: "2 · Live" },
          { key: "recap", label: due ? <span className="text-live">3 · Recap · {due}</span> : "3 · Recap" },
        ]}
      />
      {stage === "prep" && <PrepStage journey={j} />}
      {stage === "live" && <LiveStage journey={j} />}
      {stage === "recap" && <RecapStage journey={j} />}

      {stage !== "recap" && event.status === "ready" && (
        <ActionBar>
          <ButtonLink to={paths.live({ eventId: id })}>
            <Mic size={18} strokeWidth={2} aria-hidden />
            {stage === "prep" ? "I'm here. Go live" : "Start a conversation"}
          </ButtonLink>
        </ActionBar>
      )}
    </div>
  );
}

/** "3 of 8 met", or where prep is at. */
function progress(j: Journey): string | undefined {
  if (j.event?.status === "pending") return "Scouting…";
  if (!j.people.length) return j.chats.length ? `${j.chats.length} chat${j.chats.length > 1 ? "s" : ""}` : undefined;
  return `${j.met.size} of ${j.people.length} met`;
}

function EventMenu({ journey: j, onDeleted }: { journey: Journey; onDeleted: () => void }) {
  const event = j.event!;
  const rename = async () => {
    const name = window.prompt("Call this event…", event.name);
    if (name?.trim()) await call(api.updateEvent, { params: { id: event.id }, body: { name } }).then(() => j.reload());
  };
  const remove = async () => {
    if (!window.confirm(`Delete "${event.name}" and its guest list? People you've talked to stay in People.`)) return;
    await call(api.deleteEvent, { params: { id: event.id } }).then(onDeleted);
  };
  return (
    <Menu
      label="Event options"
      items={[
        { label: "Rename", onSelect: () => void rename() },
        { label: "Delete event", onSelect: () => void remove(), danger: true },
      ]}
    />
  );
}

function EventGone() {
  return (
    <div className="space-y-4">
      <BackLink to={paths.events()} label="Events" />
      <p className="text-display">This event has left the building.</p>
      <p className="text-body text-muted text-pretty">It was deleted, or the link is from another phone.</p>
    </div>
  );
}
