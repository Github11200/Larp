// Chunk 1 · Live mode: the screen you hold during a conversation. Glanceable: the hint is the screen.
import { api, type Person } from "@larp/shared";
import { Keyboard, Mic, MicOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button, fieldClass, firstName, Notice } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { LinkCard } from "../linkcards/LinkCard";
import { useLive, type Line } from "./useLive";

export function LivePage() {
  const [params] = useSearchParams();
  const live = useLive(params.get("person") ?? undefined);
  const navigate = useNavigate();
  const [typing, setTyping] = useState(false);

  const end = async () => {
    await live.stop();
    navigate(paths.followUps());
  };

  const listening = live.status === "live" && live.mic === "on";
  const micOff = live.status === "live" && live.mic !== "on";

  return (
    <div className="pt-safe pb-safe mx-auto flex h-dvh max-w-md flex-col px-5">
      <header className="flex items-center justify-between py-2">
        <Link to={paths.home()} aria-label="Leave live mode" className="-ml-2 grid size-11 place-items-center text-muted">
          <X size={22} strokeWidth={1.75} />
        </Link>
        {micOff ? (
          <button type="button" onClick={live.turnOnMic} className="flex min-h-11 items-center gap-2 px-2 text-[14px] font-medium text-muted underline decoration-line underline-offset-4">
            <MicOff size={16} strokeWidth={1.75} aria-hidden />
            Mic off, tap to start
          </button>
        ) : (
          <Status status={live.status} listening={listening} />
        )}
        <Button variant="secondary" className="min-h-10 px-4" onClick={end}>
          End
        </Button>
      </header>

      <p className="pt-3 text-[15px] text-muted">
        Talking to <span className="text-fg">{live.person ?? "someone new"}</span>
      </p>

      <main className="flex min-h-0 flex-1 flex-col justify-center gap-8 py-6">
        {/* A hint always wins; the mic prompt only fills an otherwise empty screen. */}
        {micOff && !live.hint ? <StartMic blocked={live.mic === "blocked"} onStart={live.turnOnMic} /> : <Hint text={live.hint} />}
        <Transcript lines={live.lines} />
      </main>

      <footer className="space-y-3 border-t border-line pt-3 pb-2">
        {typing && <DebugSay onSay={live.say} />}
        <div className="flex items-center gap-2">
          <PeopleStrip current={live.person} onPick={live.talkTo} />
          <button
            type="button"
            aria-label="Type instead of talking"
            aria-pressed={typing}
            onClick={() => setTyping(!typing)}
            className={`grid size-11 shrink-0 place-items-center border ${typing ? "border-fg text-fg" : "border-line text-muted"}`}
          >
            <Keyboard size={20} strokeWidth={1.75} />
          </button>
        </div>
      </footer>

      {live.card && <LinkCard link={live.card} onClose={live.dismissCard} />}
    </div>
  );
}

function Status({ status, listening }: { status: "connecting" | "live" | "ended"; listening: boolean }) {
  const elapsed = useElapsed(listening);
  const label = status === "connecting" ? "Connecting…" : status === "ended" ? "Ended" : "Listening";
  return (
    <span role="status" className="flex items-center gap-2 text-[14px] font-medium">
      <span className={`size-2 rounded-full ${listening ? "animate-breathe bg-live" : "bg-muted"}`} aria-hidden />
      {label}
      {listening && <span className="text-muted tabular-nums">{elapsed}</span>}
    </span>
  );
}

/** The whisper, set big enough to read at a glance mid-conversation. */
function Hint({ text }: { text?: string }) {
  if (!text) {
    return (
      <div className="space-y-3">
        <p data-testid="hint" className="font-serif text-[1.9rem] text-muted italic">
          Listening…
        </p>
        <p className="max-w-[30ch] text-[15px] leading-snug text-muted">
          When they ask you something or the chat goes quiet, your next line shows up here and in your ear.
        </p>
      </div>
    );
  }
  return (
    <p data-testid="hint" key={text} aria-live="polite" className="animate-hand-in font-serif text-[2.6rem] leading-[1.06] tracking-[-0.01em] text-balance">
      {text}
    </p>
  );
}

function StartMic({ blocked, onStart }: { blocked: boolean; onStart: () => void }) {
  return (
    <div className="space-y-4">
      <p className="font-serif text-[2.2rem] leading-[1.08] text-balance">Earbud in? Let it listen.</p>
      {blocked && <Notice>Mic is blocked. Allow it for this site in your browser settings, then tap again.</Notice>}
      <Button className="min-h-16 w-full text-[17px]" onClick={onStart}>
        <Mic size={20} strokeWidth={2} aria-hidden />
        {blocked ? "Try the mic again" : "Start listening"}
      </Button>
    </div>
  );
}

/** Last few lines only; older ones fade so the hint stays the focus. */
function Transcript({ lines }: { lines: Line[] }) {
  const recent = lines.slice(-4);
  if (!recent.length) return null;
  return (
    <ul className="space-y-1.5 text-[15px] leading-snug" aria-label="What's been said">
      {recent.map((l, i) => (
        <li
          key={lines.length - recent.length + i}
          style={{ opacity: 0.35 + (0.65 * (i + 1)) / recent.length }}
          className={l.speaker === "me" ? "pl-10 text-right text-muted" : "pr-10"}
        >
          {l.text}
        </li>
      ))}
    </ul>
  );
}

/** Tap who you're talking to so hints use their dossier. */
function PeopleStrip({ current, onPick }: { current?: string; onPick: (personId: string) => void }) {
  const events = useApi(api.listEvents);
  const event = events.data?.at(-1);
  if (!event) return <div className="flex-1" />;
  return <EventPeople eventId={event.id} current={current} onPick={onPick} />;
}

function EventPeople({ eventId, current, onPick }: { eventId: string; current?: string; onPick: (personId: string) => void }) {
  const people = useApi(api.listPeople, { id: eventId });
  return (
    <ul className="flex flex-1 gap-2 overflow-x-auto [scrollbar-width:none]" aria-label="Who are you talking to?">
      {people.data?.map((p) => (
        <li key={p.id} className="shrink-0">
          <PersonChip person={p} on={p.name === current} onPick={() => onPick(p.id)} />
        </li>
      ))}
    </ul>
  );
}

function PersonChip({ person, on, onPick }: { person: Person; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={`h-11 border px-4 text-[14px] font-medium ${on ? "border-fg bg-fg text-bg" : "border-line text-fg"}`}
    >
      {firstName(person.name)}
    </button>
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
        className={`${fieldClass} min-w-0 flex-1 py-2.5`}
        placeholder="type what someone says…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && say("them")}
      />
      <Button variant="secondary" className="px-3" onClick={() => say("them")}>
        them
      </Button>
      <Button variant="secondary" className="px-3" onClick={() => say("me")}>
        me
      </Button>
    </div>
  );
}

/** mm:ss since `running` turned on. */
function useElapsed(running: boolean) {
  const [start, setStart] = useState<number>();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    setStart((s) => s ?? Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const secs = start ? Math.max(0, Math.floor((now - start) / 1000)) : 0;
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}
