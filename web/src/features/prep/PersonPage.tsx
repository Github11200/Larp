// Chunk 4 · One person's dossier for one event + jump into live mode with them.
import { api } from "@larp/shared";
import { Mic } from "lucide-react";
import { Link, useParams } from "react-router";
import { ActionBar, Avatar, BackLink, ButtonLink, Pending, firstName } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { DossierSection, Links } from "./Dossier";

export function PersonPage() {
  const { id = "" } = useParams();
  const person = useApi(api.getPerson, { id }, (p) => p.dossierStatus === "pending");
  const p = person.data;
  if (!p) return person.error ? <NotFound /> : <Pending>Pulling up the file…</Pending>;

  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-5">
        <BackLink to={paths.event(p.eventId)} label="Event" />
        <header className="flex items-center gap-4">
          <Avatar name={p.name} photoUrl={p.photoUrl} size="lg" />
          <div className="min-w-0">
            <h1 className="font-serif text-[2.25rem] leading-[1.05] tracking-[-0.01em] text-balance">{p.name}</h1>
            {p.headline && <p className="mt-1 text-[15px] leading-snug text-muted">{p.headline}</p>}
          </div>
        </header>
        {p.why && <p className="text-[16px] leading-snug text-pretty">{p.why}</p>}
        <Links links={p.links} />
        {p.contactId && (
          <Link to={paths.contact(p.contactId)} className="block text-[15px] text-muted underline decoration-line">
            Everything with {firstName(p.name)}, across events
          </Link>
        )}
      </div>

      <DossierSection person={p} onChanged={() => void person.reload()} />

      <ActionBar>
        <ButtonLink to={paths.live(p.id)}>
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
      <p className="font-serif text-[2rem] leading-tight">This person left the chat.</p>
      <p className="text-[15px] text-muted text-pretty">They're not on any of your lists anymore (maybe the event was deleted). Find them in People instead.</p>
      <ButtonLink to={paths.contacts()} variant="secondary">
        Go to People
      </ButtonLink>
    </div>
  );
}
