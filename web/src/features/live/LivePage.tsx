// Chunk 1 · Live mode: the screen you hold during a conversation.
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { paths } from "../../routes";
import { LinkCard } from "../linkcards/LinkCard";
import { useLive } from "./useLive";

export function LivePage() {
  const [params] = useSearchParams();
  const live = useLive(params.get("person") ?? undefined);
  const navigate = useNavigate();

  const end = async () => {
    await live.stop();
    navigate(paths.followUps());
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <Link to={paths.home()} className="text-muted">
          ←
        </Link>
        <span className="text-sm text-muted">
          {live.status === "live" ? `● live${live.person ? ` with ${live.person}` : ""}` : live.status}
          {live.mic === "on" && " · 🎙"}
        </span>
        <button onClick={end} className="text-danger">
          End
        </button>
      </header>

      {live.status === "live" && live.mic !== "on" && (
        <button onClick={live.turnOnMic} className="rounded-2xl bg-accent p-4 text-lg font-semibold text-bg">
          {live.mic === "blocked" ? "Mic blocked. Tap to retry" : "Tap to turn on mic"}
        </button>
      )}

      <div data-testid="hint" className="rounded-2xl bg-surface p-5 text-2xl font-semibold text-accent min-h-24">
        {live.hint ?? "Listening…"}
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto text-sm">
        {live.lines.map((l, i) => (
          <li key={i} className={l.speaker === "me" ? "text-right text-fg" : l.speaker === "unknown" ? "text-center text-muted" : "text-muted"}>
            {l.text}
          </li>
        ))}
      </ul>

      <DebugSay onSay={live.say} />
      {live.card && <LinkCard link={live.card} onClose={live.dismissCard} />}
    </div>
  );
}

/** Type lines instead of talking. For building without a mic, and as a demo fallback. */
function DebugSay({ onSay }: { onSay: (speaker: "me" | "them", text: string) => void }) {
  const [text, setText] = useState("");
  const say = (speaker: "me" | "them") => {
    if (!text.trim()) return;
    onSay(speaker, text);
    setText("");
  };
  return (
    <div className="flex gap-2">
      <input
        className="flex-1 rounded-lg bg-surface p-2 text-sm"
        placeholder="type what someone says…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && say("them")}
      />
      <button className="rounded-lg bg-surface px-3 text-sm" onClick={() => say("them")}>
        them
      </button>
      <button className="rounded-lg bg-surface px-3 text-sm" onClick={() => say("me")}>
        me
      </button>
    </div>
  );
}
