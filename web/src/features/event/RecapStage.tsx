// Chunk 6 · After: who you met, what you promised, the texts already drafted.
import { ButtonLink } from "../../components/ui";
import { DueNow, FollowUpList, WeekLater } from "../followups/FollowUpsPage";
import { announceChange, isDue } from "../followups/shared";
import { paths } from "../../routes";
import type { Journey } from "./useEventJourney";

export function RecapStage({ journey: j }: { journey: Journey }) {
  const eventId = j.event!.id;
  const promises = j.followUps.reduce((n, f) => n + f.promises.length, 0);
  const onChange = () => (void j.reload(), announceChange());

  if (!j.chats.length && !j.followUps.length) {
    return (
      <div className="space-y-4">
        <p className="text-body text-muted text-pretty">Nothing to recap yet. Talk to someone and the follow-ups write themselves.</p>
        <ButtonLink to={paths.live({ eventId })} variant="secondary">
          Start a conversation
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <p className="text-body text-muted">
        {j.chats.length} chat{j.chats.length === 1 ? "" : "s"} · {promises} promise{promises === 1 ? "" : "s"} to keep
      </p>
      <DueNow followUps={j.followUps.filter(isDue)} />
      <FollowUpList followUps={j.followUps} conversations={j.allChats} eventChats={j.chats} onChange={onChange} />
      <WeekLater onDone={onChange} />
    </div>
  );
}
