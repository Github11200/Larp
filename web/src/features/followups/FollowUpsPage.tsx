// Chunk 5 · After the event: who's due a text, then every conversation grouped by event.
// Named people get follow-ups (promises + draft); unnamed chats stay as notes until you say who it was.
import { api, type Conversation, type FollowUp } from "@larp/shared";
import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Button, ButtonLink, firstName, Pending, SectionLabel, Title } from "../../components/ui";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { FollowUpCard } from "./FollowUpCard";
import { NotesCard } from "./NotesCard";
import { announceChange, conversationsOf, isDue } from "./shared";

export function FollowUpsPage() {
  const followUps = useApi(api.listFollowUps, undefined, (l) => l.some((f) => f.notesStatus === "pending"));
  // End doesn't wait forever for the server, so the chat you just left may land a few seconds after this page opens.
  const after = useSearchParams()[0].get("after");
  const [openedAt] = useState(Date.now);
  const awaiting = (l: Conversation[]) => !!after && !l.find((c) => c.id === after)?.notes && Date.now() - openedAt < 30_000;
  const convs = useApi(api.listConversations, undefined, (l) => awaiting(l) || l.some((c) => c.notes?.status === "pending"));
  const landed = !!after && !!convs.data?.find((c) => c.id === after)?.notes;
  useEffect(() => {
    if (landed) void followUps.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed]);
  const events = useApi(api.listEvents);

  const reload = () => {
    void followUps.reload();
    void convs.reload();
    announceChange();
  };
  const weekLater = async () => {
    await call(api.runNudges);
    reload();
  };

  if (followUps.loading || convs.loading) return <Pending>Remembering who you met…</Pending>;
  const fs = followUps.data ?? [];
  const cs = convs.data ?? [];
  const groups = groupByEvent(fs, cs, (id) => events.data?.find((e) => e.id === id)?.name);

  return (
    <div className="space-y-10">
      <Title sub="Who you met, what you promised, and the texts you'd never send on your own. You just hit send.">Follow-ups</Title>
      {groups.length === 0 ? (
        <div className="space-y-4 border border-dashed border-line p-5">
          <p className="text-[16px] text-pretty">Nobody yet. Talk to someone and the follow-ups write themselves.</p>
          <ButtonLink to={paths.live()} variant="secondary">
            Go live
          </ButtonLink>
        </div>
      ) : (
        <>
          <DueNow followUps={fs.filter(isDue)} />
          {groups.map((g) => (
            <section key={g.key} className="space-y-6">
              <h2 className="border-b border-line pb-2 font-serif text-[1.35rem] italic text-muted">{g.name}</h2>
              <ul className="space-y-10">
                {g.open.map((f) => (
                  <li key={f.id}>
                    <FollowUpCard followUp={f} conversations={conversationsOf(f, cs)} onChange={reload} />
                  </li>
                ))}
                {g.notes.map((c) => (
                  <li key={c.id}>
                    <NotesCard conversation={c} onChange={reload} />
                  </li>
                ))}
                {g.done.map((f) => (
                  <li key={f.id}>
                    <FollowUpCard followUp={f} conversations={conversationsOf(f, cs)} onChange={reload} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <Button variant="ghost" className="w-full" onClick={weekLater}>
            Skip to a week later
          </Button>
        </>
      )}
    </div>
  );
}

/** The nudge: "you told Sam you'd send the deck", one tap from the drafted text. */
function DueNow({ followUps }: { followUps: FollowUp[] }) {
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
            <a href={`#f-${f.id}`} className="block font-serif text-[1.35rem] leading-[1.2] text-pretty">
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

interface Group {
  key: string;
  name: string;
  open: FollowUp[];
  notes: Conversation[];
  done: FollowUp[];
  latest: number;
}

/** Newest event first; inside it, people to text, then unnamed chats, then the ones already sent. */
function groupByEvent(fs: FollowUp[], cs: Conversation[], eventName: (id: string) => string | undefined): Group[] {
  const groups = new Map<string, Group>();
  const group = (eventId: string | undefined, at: number) => {
    const key = eventId ?? "none";
    const g = groups.get(key) ?? { key, name: (eventId && eventName(eventId)) || "Off the record", open: [], notes: [], done: [], latest: 0 };
    g.latest = Math.max(g.latest, at);
    groups.set(key, g);
    return g;
  };
  const claimed = new Set(fs.flatMap((f) => conversationsOf(f, cs).map((c) => c.id)));
  for (const f of [...fs].sort((a, b) => a.dueAt - b.dueAt)) {
    const at = conversationsOf(f, cs)[0]?.startedAt ?? 0;
    group(f.eventId, at)[f.status === "done" ? "done" : "open"].push(f);
  }
  for (const c of [...cs].sort((a, b) => b.startedAt - a.startedAt)) {
    // Notes exist only once a chat ends; live mode also saves chats still in progress.
    if (!claimed.has(c.id) && c.notes) group(c.eventId, c.startedAt).notes.push(c);
  }
  return [...groups.values()].sort((a, b) => b.latest - a.latest);
}
