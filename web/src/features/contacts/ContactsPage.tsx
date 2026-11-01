// Chunk 4 · "Your people": everyone you've prepped or met, most recent interaction first.
import { api, type ContactRow } from "@larp/shared";
import { Avatar, Notice, Pending, Pill, Row, Rows, Title } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { friendlyError } from "../prep/format";
import { QuickAdd } from "./QuickAdd";
import { statusLabel, statusTone } from "./status";

export function ContactsPage() {
  const contacts = useApi(api.listContacts);
  const list = contacts.data ?? [];
  return (
    <div className="space-y-8">
      <Title>Your people</Title>
      <QuickAdd onAdded={() => void contacts.reload()} />
      {contacts.loading && <Pending>Counting your connections…</Pending>}
      {contacts.error && <Notice>{friendlyError(contacts.error)}</Notice>}
      {!contacts.loading && !list.length && <p className="text-body text-muted text-pretty">Nobody yet. Prep an event or go talk to a human.</p>}
      {list.length > 0 && (
        <Rows label="People">
          {list.map((c) => (
            <li key={c.id}>
              <ContactLine contact={c} />
            </li>
          ))}
        </Rows>
      )}
    </div>
  );
}

function ContactLine({ contact: c }: { contact: ContactRow }) {
  const events = c.eventIds.length;
  const meta = [c.headline, events > 1 && `${events} events`].filter(Boolean).join(" · ");
  return (
    <Row
      to={paths.contact(c.id)}
      lead={<Avatar name={c.name} photoUrl={c.photoUrl} />}
      title={c.name}
      meta={meta || undefined}
      trail={<Pill tone={statusTone[c.status]}>{statusLabel[c.status]}</Pill>}
    />
  );
}
