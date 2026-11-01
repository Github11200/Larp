// Chunk 4 · "Your people": everyone you've prepped or met, most recent interaction first.
import { api, type ContactRow } from "@larp/shared";
import { Link } from "react-router";
import { Avatar, Notice, Pending, Title } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { friendlyError } from "../prep/format";
import { QuickAdd } from "./QuickAdd";
import { statusLabel } from "./status";

export function ContactsPage() {
  const contacts = useApi(api.listContacts);
  const list = contacts.data ?? [];
  return (
    <div className="space-y-6">
      <Title sub="Everyone you've prepped or met, across every event. Freshest first.">Your people</Title>
      <QuickAdd onAdded={() => void contacts.reload()} />
      {contacts.loading && <Pending>Counting your connections…</Pending>}
      {contacts.error && <Notice>{friendlyError(contacts.error)}</Notice>}
      {!contacts.loading && !list.length && (
        <p className="text-[15px] text-muted text-pretty">Nobody yet. Prep an event or go talk to a human, they show up here.</p>
      )}
      <ul className="divide-y divide-line border-y border-line">
        {list.map((c) => (
          <li key={c.id}>
            <Row contact={c} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ contact: c }: { contact: ContactRow }) {
  const events = c.eventIds.length;
  return (
    <Link to={paths.contact(c.id)} className="flex items-start gap-3 py-4 active:bg-raise">
      <Avatar name={c.name} photoUrl={c.photoUrl} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[16px] font-semibold">{c.name}</span>
          <span className={`shrink-0 text-[13px] ${c.status === "followup" ? "text-live" : "text-muted"}`}>{statusLabel[c.status]}</span>
        </span>
        {c.headline && <span className="block truncate text-[14px] text-muted">{c.headline}</span>}
        {events > 1 && <span className="mt-0.5 block text-[13px] text-muted">Seen at {events} events</span>}
      </span>
    </Link>
  );
}
