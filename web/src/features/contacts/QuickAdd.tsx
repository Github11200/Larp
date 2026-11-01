// Chunk 4 · "Met someone not on the list": name + optional link/note, saved as a contact.
import { api, type Contact } from "@larp/shared";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button, Field, Notice, buttonClass, fieldClass, firstName } from "../../components/ui";
import { call } from "../../lib/api";
import { paths } from "../../routes";
import { friendlyError } from "../prep/format";

/** `eventId`: they also join that event's list, so live mode can tag them. */
export function QuickAdd({ eventId, onAdded }: { eventId?: string; onAdded?: (c: Contact) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState<Contact>();

  const save = async () => {
    setBusy(true);
    try {
      const c = await call(api.createContact, { body: { name, link: link || undefined, note: note || undefined, eventId } });
      setAdded(c);
      setOpen(false);
      setName("");
      setLink("");
      setNote("");
      setError(undefined);
      onAdded?.(c);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="space-y-2">
        {added && (
          <p className="text-body text-muted">
            Saved.{" "}
            <Link to={paths.contact(added.id)} className="text-fg underline decoration-line">
              {firstName(added.name)}'s page
            </Link>
          </p>
        )}
        <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
          <UserPlus size={18} strokeWidth={1.75} aria-hidden />
          Met someone not on the list?
        </Button>
      </div>
    );
  }
  return (
    <form
      className="space-y-4 border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field label="Their name">
        <input className={fieldClass} placeholder="The person from the snack table" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Link (optional)">
        <input className={fieldClass} inputMode="url" placeholder="linkedin.com/in/…" value={link} onChange={(e) => setLink(e.target.value)} />
      </Field>
      <Field label="Note to future you (optional)">
        <input className={fieldClass} placeholder="Wants the deck, loves F1" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <Notice>{error}</Notice>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !name.trim()} className={buttonClass("primary", "flex-1")}>
          {busy ? "Saving…" : "Save them"}
        </button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

