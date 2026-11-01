// Chunk 6 · Guided first run: You -> Event -> People -> live. Steps reuse the feature screens
// (Me, People) so setup always shows whatever those chunks currently build.
import { api } from "@larp/shared";
import { Navigate, useNavigate, useParams } from "react-router";
import { ButtonLink, Title } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths, type SetupStep } from "../../routes";
import { AddEvent } from "../prep/EventsPage";
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
  const navigate = useNavigate();
  return (
    <SetupFrame
      step="event"
      back={paths.setup("you")}
      actions={
        <ButtonLink to={paths.live()} variant="ghost">
          No event? Go live anyway
        </ButtonLink>
      }
    >
      <div className="space-y-8">
        <Title sub="Link, screenshots, or names. Any one works.">Where are you headed?</Title>
        <AddEvent onAdded={() => navigate(paths.setup("people"))} />
      </div>
    </SetupFrame>
  );
}
