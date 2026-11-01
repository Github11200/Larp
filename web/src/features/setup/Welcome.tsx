// Chunk 6 · First screen a new user sees: what this is, a taste of a whisper, and two ways in.
import { api } from "@larp/shared";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, ButtonLink, Quote } from "../../components/ui";
import { call } from "../../lib/api";
import { paths } from "../../routes";

export function Welcome() {
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);

  // Judges and curious people skip setup: load the demo crowd and go straight to picking who to meet.
  const useDemo = async () => {
    setSeeding(true);
    await call(api.seedDemo).finally(() => setSeeding(false));
    navigate(paths.setup("people"));
  };

  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8">
      <p className="pt-2 font-serif text-[1.35rem] italic">Larp</p>

      <div className="flex flex-1 flex-col justify-center gap-7 py-6">
        <h1 className="font-serif text-[2.75rem] leading-[1] tracking-[-0.015em] text-balance">
          Larp as the most prepared person in the room.
        </h1>

        <figure className="space-y-3 border-l border-line pl-5">
          <figcaption className="flex items-center gap-2 text-[13px] text-muted">
            <span className="size-1.5 animate-breathe rounded-full bg-live" aria-hidden />
            in your ear, right now
          </figcaption>
          <Quote>Ask Sam how VoiceKit handles barge-in.</Quote>
        </figure>

        <p className="text-[16px] leading-relaxed text-muted text-pretty">
          It learns you, scouts who's at your event, whispers what to say mid-conversation, and remembers who you promised a deck to. You just nod.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <ButtonLink to={paths.setup("you")}>Set me up (takes a minute)</ButtonLink>
        <Button variant="secondary" onClick={useDemo} disabled={seeding}>
          {seeding ? "Summoning the demo crowd…" : "Skip, use the demo crowd"}
        </Button>
      </div>
    </div>
  );
}
