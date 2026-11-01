// Chunk 6 · During: who's still worth finding, and the chats you've had so far tonight.
import type { Conversation } from "@larp/shared";
import { Mic } from "lucide-react";
import { Link } from "react-router";
import { Avatar, Pill, Row, Rows, SectionLabel, firstName } from "../../components/ui";
import { paths } from "../../routes";
import { chatTitle } from "./journey";
import type { Journey } from "./useEventJourney";

/** Enough to scan while walking across a room; the rest live in Prep. */
const UP_NEXT = 4;

export function LiveStage({ journey: j }: { journey: Journey }) {
  const eventId = j.event!.id;
  const upNext = j.toMeet.slice(0, UP_NEXT);
  const more = j.toMeet.length - upNext.length;

  return (
    <div className="space-y-8">
      {j.chats.length > 0 ? (
        <section className="space-y-2">
          <SectionLabel>Tonight so far · {j.chats.length}</SectionLabel>
          <Rows>
            {j.chats.map((c) => (
              <li key={c.id}>
                <ChatRow chat={c} eventId={eventId} />
              </li>
            ))}
          </Rows>
        </section>
      ) : (
        <p className="text-body text-muted text-pretty">Tap who you're walking up to, or just start talking. The coach catches names.</p>
      )}

      {upNext.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>Still to meet</SectionLabel>
          <Rows>
            {upNext.map((p) => (
              <li key={p.id}>
                <Row
                  to={paths.live({ personId: p.id, eventId })}
                  lead={<Avatar name={p.name} photoUrl={p.photoUrl} />}
                  title={p.name}
                  meta={p.why ?? p.headline}
                  chevron={false}
                  trail={
                    <span className="grid size-10 shrink-0 place-items-center border border-line" aria-label={`Talk to ${firstName(p.name)}`}>
                      <Mic size={18} strokeWidth={1.75} aria-hidden />
                    </span>
                  }
                />
              </li>
            ))}
          </Rows>
          {more > 0 && (
            <Link to={paths.event(eventId, "prep")} className="block pt-1 text-meta text-muted">
              + {more} more on the list
            </Link>
          )}
        </section>
      )}
    </div>
  );
}

function ChatRow({ chat: c, eventId }: { chat: Conversation; eventId: string }) {
  const writing = !c.notes || c.notes.status === "pending";
  return (
    <Row
      to={paths.event(eventId, "recap")}
      lead={<Avatar name={chatTitle(c)} />}
      title={chatTitle(c)}
      meta={writing ? "Writing up notes…" : c.notes?.summary}
      trail={writing ? <Pill tone="live">Notes</Pill> : <Pill tone="done">Saved</Pill>}
    />
  );
}
