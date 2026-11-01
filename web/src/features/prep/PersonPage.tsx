// Chunk 4 · One person's dossier for one event + jump into live mode with them.
import { api } from "@larp/shared";
import { Mic } from "lucide-react";
import { useParams } from "react-router";
import { ActionBar, BackLink, ButtonLink, Pending, Row, Rows, firstName } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { DossierMenu, DossierSection, Links, PersonHeader, useDossierBuild } from "./Dossier";

export function PersonPage() {
  const { id = "" } = useParams();
  const person = useApi(api.getPerson, { id }, (p) => p.dossierStatus === "pending");
  const p = person.data;
  const dossier = useDossierBuild(p ?? undefined, () => void person.reload());
  if (!p) return person.error ? <NotFound /> : <Pending>Pulling up the file…</Pending>;

  return (
    <div className="space-y-8 pb-24">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <BackLink to={paths.event(p.eventId)} label="Event" />
          <DossierMenu person={p} build={dossier.build} />
        </div>
        <PersonHeader name={p.name} photoUrl={p.photoUrl} headline={p.headline} />
        {p.why && <p className="text-body text-pretty">{p.why}</p>}
      </div>

      <DossierSection person={p} {...dossier} />

      <Links links={p.links} />

      {p.contactId && (
        <Rows>
          <li>
            <Row to={paths.contact(p.contactId)} title={`Everything with ${firstName(p.name)}`} meta="Across events, chats and follow-ups" />
          </li>
        </Rows>
      )}

      <ActionBar>
        <ButtonLink to={paths.live({ personId: p.id, eventId: p.eventId })}>
          <Mic size={18} strokeWidth={2} aria-hidden />
          Talk to {firstName(p.name)}
        </ButtonLink>
      </ActionBar>
    </div>
  );
}

function NotFound() {
  return (
    <div className="space-y-4">
      <BackLink to={paths.home()} label="Events" />
      <p className="text-display">This person left the chat.</p>
      <p className="text-body text-muted text-pretty">Maybe the event was deleted. Try People.</p>
      <ButtonLink to={paths.contacts()} variant="secondary">
        Go to People
      </ButtonLink>
    </div>
  );
}
