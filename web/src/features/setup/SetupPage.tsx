// Chunk 6 · Guided first run: You -> Event -> People -> live. Steps reuse the feature screens
// (Me, People) so setup always shows whatever those chunks currently build.
import { api } from "@larp/shared";
import { Navigate, useParams } from "react-router";
import { ButtonLink } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths, type SetupStep } from "../../routes";
import { EventsPage } from "../prep/EventsPage";
import { ProfilePage } from "../profile/ProfilePage";
import { PeoplePicker } from "./PeoplePicker";
import { SetupFrame } from "./SetupFrame";
import { Welcome } from "./Welcome";

export function SetupPage() {
  const { step } = useParams<{ step?: SetupStep }>();
  if (!step) return <Welcome />;
  if (step === "you") return <YouStep />;
  if (step === "event") return <EventStep />;
  if (step === "people") return <PeoplePicker />;
  return <Navigate to={paths.setup()} replace />;
}

function YouStep() {
  const profile = useApi(api.getProfile, undefined, (p) => !p);
  const started = Boolean(profile.data);
  return (
    <SetupFrame
      step="you"
      back={paths.setup()}
      actions={
        // Profile builds in the background, so nobody waits on it.
        <ButtonLink to={paths.setup("event")} variant={started ? "primary" : "ghost"}>
          {started ? "Next: your event" : "Skip, I'll do this later"}
        </ButtonLink>
      }
    >
      <ProfilePage />
    </SetupFrame>
  );
}

function EventStep() {
  const events = useApi(api.listEvents, undefined, (es) => es.length === 0);
  const hasEvent = Boolean(events.data?.length);
  return (
    <SetupFrame
      step="event"
      back={paths.setup("you")}
      actions={
        hasEvent ? (
          <ButtonLink to={paths.setup("people")}>Next: pick who to meet</ButtonLink>
        ) : (
          <ButtonLink to={paths.live()} variant="ghost">
            No event? Go live anyway
          </ButtonLink>
        )
      }
    >
      <EventsPage />
    </SetupFrame>
  );
}
