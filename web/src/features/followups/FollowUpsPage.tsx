// Chunk 5 · After the event: who's due a text, and every chat's write-up.
// Each event's Recap shows its own slice (FollowUpList); /followups shows them all, grouped by event.
import { api, type Conversation, type FollowUp } from "@larp/shared";
import { BellRing } from "lucide-react";
import { Link } from "react-router";
import { Button, firstName, Pending, SectionLabel, Title } from "../../components/ui";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { FollowUpCard } from "./FollowUpCard";
import { NotesCard } from "./NotesCard";
import { announceChange, conversationsOf, isDue } from "./shared";

export function FollowUpsPage() {
  const followUps = useApi(api.listFollowUps, undefined, (l) => l.some((f) => f.notesStatus === "pending"));
  const convs = useApi(api.listConversations, undefined, (l) => l.some((c) => c.notes?.status === "pending"));
  const events = useApi(api.listEvents);
  const reload = () => (void followUps.reload(), void convs.reload(), announceChange());

  if (followUps.loading || convs.loading) return <Pending>Remembering who you met…</Pending>;
  const fs = followUps.data ?? [];
  const cs = convs.data ?? [];
  const groups = groupByEvent(fs, cs);

  return (
    <div className="space-y-10">
      <Title>Follow-ups</Title>
      {groups.length === 0 ? (
        <p className="text-body text-muted">Nobody yet. Talk to someone and these write themselves.</p>
      ) : (
        <>
          <DueNow followUps={fs.filter(isDue)} />
          {groups.map((g) => {
            const name = events.data?.find((e) => e.id === g.eventId)?.name ?? "Off the record";
            return (
              <section key={g.eventId ?? "none"} className="space-y-6">
                <h2 className="border-b border-line pb-2 text-title text-muted">
                  {g.eventId ? <Link to={paths.event(g.eventId, "recap")}>{name}</Link> : name}
                </h2>
                <FollowUpList followUps={g.followUps} conversations={cs} eventChats={g.chats} onChange={reload} />
              </section>
            );
          })}
          <WeekLater onDone={reload} />
        </>
      )}
    </div>
  );
}

/** One event's after-party: people to text, then unnamed chats, then the ones already sent. */
export function FollowUpList({
  followUps,
  conversations,
  eventChats,
  onChange,
}: {
  followUps: FollowUp[];
  /** Every conversation, so follow-ups can show what was said. */
  conversations: Conversation[];
  /** This event's chats; the ones no follow-up claims show as notes. */
  eventChats: Conversation[];
  onChange: () => void;
}) {
  const sorted = [...followUps].sort((a, b) => a.dueAt - b.dueAt);
  const claimed = new Set(followUps.flatMap((f) => conversationsOf(f, conversations).map((c) => c.id)));
  // Notes exist only once a chat ends; live mode also saves chats still in progress.
  const notes = eventChats.filter((c) => !claimed.has(c.id) && c.notes);
  const card = (f: FollowUp) => (
    <li key={f.id} id={`f-${f.id}`}>
      <FollowUpCard followUp={f} conversations={conversationsOf(f, conversations)} onChange={onChange} />
    </li>
  );
  return (
    <ul className="space-y-10">
      {sorted.filter((f) => f.status !== "done").map(card)}
      {notes.map((c) => (
        <li key={c.id}>
          <NotesCard conversation={c} onChange={onChange} />
        </li>
      ))}
      {sorted.filter((f) => f.status === "done").map(card)}
    </ul>
  );
}

/** The nudge: "you told Sam you'd send the deck", one tap from the drafted text. */
export function DueNow({ followUps }: { followUps: FollowUp[] }) {
  if (!followUps.length) return null;
  return (
    <section className="space-y-3 border border-live/60 p-4" data-testid="due-now">
      <SectionLabel>
        <span className="flex items-center gap-2 text-live">
          <BellRing size={16} strokeWidth={2} aria-hidden />
          It's been a week. Don't ghost them.
        </span>
      </SectionLabel>
      <ul className="space-y-3">
        {followUps.map((f) => (
          <li key={f.id}>
            <a href={`#f-${f.id}`} className="block text-title text-pretty">
              {f.promises[0]
                ? `You told ${firstName(f.personName)} you'd ${f.promises[0]}.`
                : `Text ${firstName(f.personName)} before they forget your face.`}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Demo shortcut: run the nudge cron now, as if a week went by. */
export function WeekLater({ onDone }: { onDone: () => void }) {
  return (
    <Button variant="ghost" className="w-full" onClick={() => void call(api.runNudges).then(onDone)}>
      Skip to a week later
    </Button>
  );
}

/** Newest event first. */
function groupByEvent(fs: FollowUp[], cs: Conversation[]) {
  const groups = new Map<string, { eventId?: string; followUps: FollowUp[]; chats: Conversation[]; latest: number }>();
  const group = (eventId: string | undefined) => {
    const key = eventId ?? "none";
    const g = groups.get(key) ?? { eventId, followUps: [], chats: [], latest: 0 };
    groups.set(key, g);
    return g;
  };
  for (const f of fs) {
    const g = group(f.eventId);
    g.followUps.push(f);
    g.latest = Math.max(g.latest, conversationsOf(f, cs)[0]?.startedAt ?? 0);
  }
  for (const c of cs) {
    if (!c.notes) continue;
    const g = group(c.eventId);
    g.chats.push(c);
    g.latest = Math.max(g.latest, c.startedAt);
  }
  return [...groups.values()].sort((a, b) => b.latest - a.latest);
}
