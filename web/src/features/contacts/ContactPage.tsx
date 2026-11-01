// Chunk 4 · One human's timeline across everything: dossier, events, conversations, follow-ups.
import { api, type ContactTimeline, type Conversation, type FollowUp } from "@larp/shared";
import { Mic } from "lucide-react";
import type { ReactNode } from "react";
import { useParams } from "react-router";
import { ActionBar, BackLink, ButtonLink, Notice, Pending, Pill, Row, Rows, SectionLabel, firstName } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { isDue, sentence } from "../followups/shared";
import { DossierMenu, DossierSection, Links, PersonHeader, useDossierBuild } from "../prep/Dossier";
import { formatWhen } from "../prep/format";
import { statusLabel, statusTone } from "./status";

export function ContactPage() {
  const { id = "" } = useParams();
  const timeline = useApi(api.getContact, { id }, (t) => t.people.some((p) => p.dossierStatus === "pending"));
  const t = timeline.data;
  // Newest event's entry: freshest dossier, and who live mode should tag.
  const person = t && [...t.people].sort((a, b) => eventOrder(t, a.eventId) - eventOrder(t, b.eventId)).at(-1);
  const dossierPerson = (t && [...t.people].reverse().find((p) => p.dossier)) ?? person;
  const dossier = useDossierBuild(dossierPerson, () => void timeline.reload());
  if (!t) return timeline.error ? <NotFound /> : <Pending>Pulling up everything on them…</Pending>;

  const c = t.contact;
  return (
    <div className="space-y-8 pb-24">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <BackLink to={paths.contacts()} label="People" />
          {dossierPerson && <DossierMenu person={dossierPerson} build={dossier.build} />}
        </div>
        <PersonHeader name={c.name} photoUrl={c.photoUrl} headline={c.headline}>
          <Pill tone={statusTone[t.status]}>{statusLabel[t.status]}</Pill>
        </PersonHeader>
        {c.note && <p className="border-l border-line pl-4 text-body whitespace-pre-line text-pretty">{c.note}</p>}
      </div>

      <Learned items={[...new Set(t.followUps.flatMap((f) => f.learned))]} />

      {dossierPerson && <DossierSection person={dossierPerson} {...dossier} />}

      <Links links={c.links} />

      {t.followUps.length > 0 && (
        <Section title="Follow-ups">
          {t.followUps.map((f) => (
            <li key={f.id}>
              <FollowUpLine followUp={f} />
            </li>
          ))}
        </Section>
      )}

      <Section title="Conversations" empty="You haven't talked yet. Go say hi.">
        {t.conversations.map((cv) => (
          <li key={cv.id} className="py-3">
            <ConversationLine conversation={cv} name={c.name} />
          </li>
        ))}
      </Section>

      <Section title="Seen at" empty="No events together. Met in the wild.">
        {t.events.map((e) => (
          <li key={e.id}>
            <Row to={paths.event(e.id)} title={e.name} meta={(e.date || e.createdAt) && formatWhen(e.date ?? e.createdAt!)} />
          </li>
        ))}
      </Section>

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
    <section className="space-y-3">
      <SectionLabel>What you learned IRL</SectionLabel>
      <ul className="list-disc space-y-1 pl-5 text-body marker:text-muted">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}

const eventOrder = (t: ContactTimeline, eventId: string) => t.events.findIndex((e) => e.id === eventId);

function Section({ title, empty, children }: { title: string; empty?: string; children: ReactNode[] }) {
  return (
    <section className="space-y-3">
      <SectionLabel>{title}</SectionLabel>
      {children.length ? <Rows>{children}</Rows> : <p className="text-body text-muted">{empty}</p>}
    </section>
  );
}

function ConversationLine({ conversation: cv, name }: { conversation: Conversation; name: string }) {
  const others = cv.participants.map((p) => p.name).filter((n) => n.toLowerCase() !== name.toLowerCase());
  const said = cv.notes?.summary || cv.transcript.find((u) => u.speaker === "them")?.text;
  return (
    <div className="space-y-1">
      <p className="text-meta text-muted">
        {formatWhen(cv.startedAt)}
        {others.length > 0 && ` · with ${others.join(", ")}`}
        {` · ${cv.transcript.length} lines`}
      </p>
      {said && <p className="text-body text-pretty">{said}</p>}
    </div>
  );
}

function FollowUpLine({ followUp: f }: { followUp: FollowUp }) {
  const done = f.status === "done";
  const pill = done ? <Pill tone="done">Sent</Pill> : isDue(f) ? <Pill tone="live">Due</Pill> : <Pill>Open</Pill>;
  return (
    <Row
      to={paths.followUps()}
      title={f.promises.length ? sentence(f.promises.join("; ")) : f.summary}
      meta={f.theirPromises.length > 0 && `They owe you: ${f.theirPromises.join("; ")}`}
      trail={pill}
    />
  );
}

function NotFound() {
  return (
    <div className="space-y-4">
      <BackLink to={paths.contacts()} label="People" />
      <p className="text-display">Who? Never heard of them.</p>
      <Notice>This contact doesn't exist anymore. Maybe their only event was deleted.</Notice>
    </div>
  );
}
