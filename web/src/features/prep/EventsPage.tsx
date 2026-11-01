// Chunk 4 · Getting an event in: link, guest-list screenshots, or pasted names. Rescue a failed scrape in place.
import { api, type Event } from "@larp/shared";
import { useState } from "react";
import { useNavigate } from "react-router";
import { BackLink, Button, Field, FilePick, Notice, Title, fieldClass } from "../../components/ui";
import { call } from "../../lib/api";
import { paths } from "../../routes";
import { friendlyError } from "./format";
import { toDataUrl } from "./images";

/** `/events/new`: add an event, then land on its hub. */
export function NewEventPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <BackLink to={paths.events()} label="Events" />
        <Title sub="Any one of these works.">Where are you headed?</Title>
      </div>
      <AddEvent onAdded={(e) => navigate(paths.event(e.id, "prep"), { replace: true })} />
    </div>
  );
}

export function AddEvent({ onAdded }: { onAdded: (e: Event) => void }) {
  const [url, setUrl] = useState("");
  const [guestList, setGuestList] = useState("");
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const pickShots = async (files: FileList | null) => setScreenshots(await Promise.all([...(files ?? [])].map(toDataUrl)));
  const run = async (work: () => Promise<Event>) => {
    setBusy(true);
    setError(undefined);
    try {
      onAdded(await work());
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = () =>
    run(() =>
      call(api.createEvent, {
        body: { url: url || undefined, guestList: guestList || undefined, screenshots: screenshots.length ? screenshots : undefined },
      }),
    );
  const seed = () =>
    run(async () => {
      await call(api.seedDemo);
      return (await call(api.listEvents)).at(-1)!;
    });

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <Field label="Event link">
          <input
            type="url"
            inputMode="url"
            className={fieldClass}
            placeholder="lu.ma/…, eventbrite, whatever"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <Field label="Guest list screenshots">
          <FilePick
            label="Add screenshots"
            picked={screenshots.length ? `${screenshots.length} screenshot${screenshots.length > 1 ? "s" : ""}` : undefined}
            accept="image/*"
            multiple
            icon="image"
            onPick={(files) => void pickShots(files)}
          />
        </Field>
        <Field label="Or paste names, one per line">
          <textarea
            className={`${fieldClass} h-24 resize-none`}
            placeholder={"Sam Chen - Founder, VoiceKit\nPriya Patel - ML eng"}
            value={guestList}
            onChange={(e) => setGuestList(e.target.value)}
          />
        </Field>
      </div>
      {error && <Notice>{error}</Notice>}
      <div className="flex flex-col gap-2">
        <Button onClick={() => void submit()} disabled={busy || (!url && !guestList && !screenshots.length)}>
          {busy ? "Sending in the scouts…" : "Scout the room"}
        </Button>
        <Button variant="ghost" onClick={() => void seed()} disabled={busy}>
          Use the demo event instead
        </Button>
      </div>
    </div>
  );
}

/** Rescue a failed event in place, or add people the scrape missed: paste names, keep the event. */
export function AddNames({ eventId, onSent, cta = "Scout these" }: { eventId: string; onSent: () => void; cta?: string }) {
  const [guestList, setGuestList] = useState("");
  const [error, setError] = useState<string>();
  const send = () =>
    call(api.addGuests, { params: { id: eventId }, body: { guestList } }).then(() => (setGuestList(""), onSent()), (e) => setError(friendlyError(e)));
  return (
    <div className="space-y-3">
      <Field label="Paste names, one per line">
        <textarea
          className={`${fieldClass} h-28 resize-none`}
          placeholder={"Sam Chen - Founder, VoiceKit\nPriya Patel - ML eng"}
          value={guestList}
          onChange={(e) => setGuestList(e.target.value)}
        />
      </Field>
      {error && <Notice>{error}</Notice>}
      <Button className="w-full" onClick={() => void send()} disabled={!guestList.trim()}>
        {cta}
      </Button>
    </div>
  );
}
