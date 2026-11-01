// Chunk 4 · One human's timeline across everything: dossier, events, conversations, follow-ups.
import { api, type ContactTimeline, type Conversation, type FollowUp } from "@larp/shared";
import { Mic } from "lucide-react";
import { Link, useParams } from "react-router";
import { ActionBar, Avatar, BackLink, ButtonLink, Notice, Pending, SectionLabel, firstName } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { DossierSection, Links } from "../prep/Dossier";
import { formatWhen } from "../prep/format";
import { statusLabel } from "./status";

export function ContactPage() {
  const { id = "" } = useParams();
  const timeline = useApi(api.getContact, { id }, (t) => t.people.some((p) => p.dossierStatus === "pending"));
  const t = timeline.data;
  if (!t) return timeline.error ? <NotFound /> : <Pending>Pulling up everything on them…</Pending>;

  const c = t.contact;
  // Newest event's entry: freshest dossier, and who live mode should tag.
  const person = [...t.people].sort((a, b) => eventOrder(t, a.eventId) - eventOrder(t, b.eventId)).at(-1);
  const dossierPerson = [...t.people].reverse().find((p) => p.dossier) ?? person;

  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-5">
        <BackLink to={paths.contacts()} label="People" />
        <header className="flex items-center gap-4">
          <Avatar name={c.name} photoUrl={c.photoUrl} size="lg" />
          <div className="min-w-0">
            <h1 className="font-serif text-[2.25rem] leading-[1.05] tracking-[-0.01em] text-balance">{c.name}</h1>
            {c.headline && <p className="mt-1 text-[15px] leading-snug text-muted">{c.headline}</p>}
            <p className={`mt-1 text-[13px] ${t.status === "followup" ? "text-live" : "text-muted"}`}>{statusLabel[t.status]}</p>
          </div>
        </header>
        <Links links={c.links} />
        {c.note && <p className="border-l border-line pl-4 text-[15px] whitespace-pre-line text-pretty">{c.note}</p>}
      </div>

      <Learned items={[...new Set(t.followUps.flatMap((f) => f.learned))]} />

      {dossierPerson && <DossierSection person={dossierPerson} onChanged={() => void timeline.reload()} />}

      <Section title="Seen at" empty="No events together yet. Met in the wild.">
        {t.events.map((e) => (
          <li key={e.id}>
            <Link to={paths.event(e.id)} className="block py-3 active:bg-raise">
              <span className="block font-serif text-[1.25rem] leading-tight">{e.name}</span>
              {(e.date || e.createdAt) && <span className="text-[14px] text-muted">{formatWhen(e.date ?? e.createdAt!)}</span>}
            </Link>
          </li>
        ))}
      </Section>

      <Section title="Conversations" empty="You haven't talked yet. Go say hi.">
        {t.conversations.map((cv) => (
          <li key={cv.id} className="py-3">
            <ConversationLine conversation={cv} name={c.name} />
          </li>
        ))}
      </Section>

      {t.followUps.length > 0 && (
        <Section title="Follow-ups">
          {t.followUps.map((f) => (
            <li key={f.id} className="py-3">
              <FollowUpLine followUp={f} />
            </li>
          ))}
        </Section>
      )}

      {person && (
        <ActionBar>
          <ButtonLink to={paths.live({ personId: person.id, eventId: person.eventId })}>
            <Mic size={18} strokeWidth={2} aria-hidden />
            Talk to {firstName(c.name)}
          </ButtonLink>
        </ActionBar>
      )}
    </div>
  );
}

/** Facts from your actual conversations beat the pre-event dossier, so they go first. */
function Learned({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <SectionLabel>What you learned IRL</SectionLabel>
      <ul className="divide-y divide-line border-y border-line">
        {items.map((i) => (
          <li key={i} className="py-2.5 text-[16px]">
            {i}
          </li>
        ))}
      </ul>
    </section>
  );
}

const eventOrder = (t: ContactTimeline, eventId: string) => t.events.findIndex((e) => e.id === eventId);

function Section({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode[] }) {
  return (
    <section className="space-y-2">
      <SectionLabel>{title}</SectionLabel>
      {children.length ? (
        <ul className="divide-y divide-line border-y border-line">{children}</ul>
      ) : (
        <p className="text-[15px] text-muted">{empty}</p>
      )}
    </section>
  );
}

function ConversationLine({ conversation: cv, name }: { conversation: Conversation; name: string }) {
  const others = cv.participants.map((p) => p.name).filter((n) => n.toLowerCase() !== name.toLowerCase());
  const said = cv.notes?.summary || cv.transcript.find((u) => u.speaker === "them")?.text;
  return (
    <div className="space-y-1">
      <p className="text-[14px] text-muted">
        {formatWhen(cv.startedAt)}
        {others.length > 0 && ` · with ${others.join(", ")}`}
        {` · ${cv.transcript.length} lines`}
      </p>
      {said && <p className="font-serif text-[1.15rem] leading-snug text-pretty">“{said}”</p>}
    </div>
  );
}

function FollowUpLine({ followUp: f }: { followUp: FollowUp }) {
  return (
    <Link to={paths.followUps()} className="block space-y-1">
      <p className={`text-[13px] font-semibold ${f.status === "done" ? "text-muted" : "text-live"}`}>{f.status === "done" ? "Done" : "You promised"}</p>
      {f.theirPromises.length > 0 && <p className="text-[14px] text-muted">They owe you: {f.theirPromises.join("; ")}</p>}
      {f.promises.length > 0 ? (
        <ul className="list-disc pl-5 text-[15px]">
          {f.promises.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-pretty">{f.summary}</p>
      )}
    </Link>
  );
}

function NotFound() {
  return (
    <div className="space-y-4">
      <BackLink to={paths.contacts()} label="People" />
      <p className="font-serif text-[2rem] leading-tight">Who? Never heard of them.</p>
      <Notice>This contact doesn't exist (anymore). Maybe their only event was deleted.</Notice>
    </div>
  );
}
