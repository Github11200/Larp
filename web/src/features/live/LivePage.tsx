// Chunk 1 · Live mode: the screen you hold during a conversation. Glanceable: the hint is the screen.
// Covers 1:1 with someone prepped, a stranger, or a whole circle: tap everyone who's there,
// or just talk and the coach catches names as they're said.
import { api, type Participant, type Person } from "@larp/shared";
import { Check, MessageCircleQuestion, Mic, Phone, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button, fieldClass, firstName, Notice, Quote } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { metIds } from "../event/journey";
import { LinkCard } from "../linkcards/LinkCard";
import { EscapeCall, useEscapePhrase } from "./EscapeCall";
import { useLive, type Line, type LiveStatus, type MicState } from "./useLive";
import { useHeadsetNudge } from "./useHeadsetNudge";
import { useWakeLock } from "./useWakeLock";

export function LivePage() {
  const [params] = useSearchParams();
  const live = useLive(params.get("person") ?? undefined, params.get("event") ?? undefined);
  const navigate = useNavigate();
  const noEars = live.ears === false;
  const [typing, setTyping] = useState(false);
  const started = live.mic === "on" || noEars;
  const room = useRoom(live.eventId, live.conversationId);
  useWakeLock(live.status !== "ended" && started);
  const canNudge = live.status !== "ended" && started;
  useHeadsetNudge(canNudge, live.nudge);
  const [calling, setCalling] = useState(false);
  const call = (on: boolean) => (live.hold(on), setCalling(on));
  useEscapePhrase(live.lines, () => call(true));

  // Back to the event you're at; the chat you just had shows up there, notes cooking.
  const end = async () => {
    await live.stop();
    navigate(live.eventId ? paths.event(live.eventId, "live") : paths.home());
  };

  return (
    <div className="pt-safe pb-safe mx-auto flex h-dvh max-w-md flex-col px-5">
      <header className="flex items-center justify-between gap-4 py-2">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-meta text-muted" data-testid="live-event">
            {room.eventName ? `${room.eventName}${room.total ? ` · ${room.met.size} of ${room.total} met` : ""}` : "No event"}
          </p>
          <Status status={live.status} mic={live.mic} noEars={noEars} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" aria-label="Fake a call to get out" onClick={() => call(true)} className="flex size-10 items-center justify-center text-muted">
            <Phone size={18} strokeWidth={2} aria-hidden />
          </button>
          <Button variant="secondary" className="min-h-10 px-4" onClick={() => void end()}>
            {live.lines.length ? "End chat" : "Leave"}
          </Button>
        </div>
      </header>

      <Who participants={live.participants} attendees={room.attendees} met={room.met} onAdd={live.add} onRemove={live.remove} />

      <main className="flex min-h-0 flex-1 flex-col justify-center gap-8 py-6">
        {live.hint ? <Hint text={live.hint} /> : <SayThis openers={live.openers} listening={live.mic === "on"} />}
        {!started && live.status !== "connecting" && <StartButton mic={live.mic} resume={live.lines.length > 0} onStart={live.start} />}
        {noEars && <Notice>No ears on this server (no ElevenLabs key). Type what people say below and the coach still works.</Notice>}
        <Transcript lines={live.lines} />
      </main>

      <footer className="space-y-2 border-t border-line pt-2 pb-2">
        {canNudge && <NudgeButton onNudge={live.nudge} />}
        {(typing || noEars) && <DebugSay onSay={live.say} />}
        {!noEars && (
          <button type="button" aria-pressed={typing} onClick={() => setTyping(!typing)} className="min-h-10 text-meta text-muted underline decoration-line underline-offset-4">
            {typing ? "hide typing" : "demo: type a line"}
          </button>
        )}
      </footer>

      {live.card && <LinkCard link={live.card} onClose={live.dismissCard} />}
      {calling && <EscapeCall audio={live} onDecline={() => call(false)} onHangUp={() => void end()} />}
    </div>
  );
}

/** The event around this chat: its name, attendees (prepped first), and who you've already met there. Fetched once, off the live path. */
function useRoom(eventId?: string, conversationId?: string) {
  const events = useApi(api.listEvents);
  const people = useApi(api.listPeople, eventId ? { id: eventId } : undefined); // no event yet: request fails quietly, no chips
  const convs = useApi(api.listConversations);
  const earlier = (convs.data ?? []).filter((c) => c.eventId === eventId && c.id !== conversationId);
  const attendees = eventId ? prepFirst(people.data ?? []) : [];
  return {
    eventName: events.data?.find((e) => e.id === eventId)?.name,
    attendees,
    total: attendees.length,
    met: metIds(earlier, []),
  };
}

function Status({ status, mic, noEars }: { status: LiveStatus; mic: MicState; noEars: boolean }) {
  const listening = status === "ready" && mic === "on";
  const elapsed = useElapsed(listening);
  const label =
    status === "connecting"
      ? "Connecting…"
      : status === "reconnecting"
        ? "Reconnecting…"
        : status === "ended"
          ? "Saved"
          : listening
            ? "live"
            : noEars
              ? "typing mode"
              : "not listening";
  return (
    <span role="status" className="flex items-center gap-2 text-meta font-semibold tracking-wide">
      <span
        aria-hidden
        className={`size-2.5 rounded-full ${listening ? "animate-breathe bg-danger" : status === "reconnecting" ? "animate-breathe bg-muted" : "bg-muted"}`}
      />
      <span className={listening ? "text-danger uppercase" : "text-muted"}>{label}</span>
      {listening && <span className="text-muted tabular-nums">{elapsed}</span>}
    </span>
  );
}

/** Who's in the conversation: tap people from the event (several = a group), or add a stranger by name. Met earlier = check. */
function Who({
  participants,
  attendees,
  met,
  onAdd,
  onRemove,
}: {
  participants: Participant[];
  attendees: Person[];
  met: Set<string>;
  onAdd: (who: { personId?: string; name?: string }) => void;
  onRemove: (who: { personId?: string; name?: string }) => void;
}) {
  const unprepped = participants.filter((p) => !p.personId);
  const isIn = (id: string) => participants.some((p) => p.personId === id);
  const [naming, setNaming] = useState(false);

  return (
    <section className="space-y-2 pt-1" aria-label="Who's here">
      <p className="text-body text-muted">
        Talking to <span className="text-fg">{talkingTo(participants)}</span>
      </p>
      <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
        {attendees.map((p) => (
          <li key={p.id} className="shrink-0">
            <Chip
              on={isIn(p.id)}
              label={firstName(p.name)}
              done={met.has(p.id)}
              onClick={() => (isIn(p.id) ? onRemove({ personId: p.id }) : onAdd({ personId: p.id }))}
            />
          </li>
        ))}
        {unprepped.map((p) => (
          <li key={p.name} className="shrink-0">
            <Chip on label={p.name} onClick={() => onRemove({ name: p.name })} />
          </li>
        ))}
        <li className="shrink-0">
          {naming ? (
            <NameInput onDone={(name) => (setNaming(false), name && onAdd({ name }))} />
          ) : (
            <button type="button" onClick={() => setNaming(true)} className="flex h-11 items-center gap-1.5 border border-dashed border-line px-4 text-body text-muted">
              <Plus size={16} strokeWidth={2} aria-hidden />
              someone new
            </button>
          )}
        </li>
      </ul>
    </section>
  );
}

const prepFirst = (people: Person[]) => {
  const prepped = (p: Person) => (p.dossier || p.dossierStatus === "pending" ? 0 : 1);
  return [...people].sort((a, b) => prepped(a) - prepped(b));
};

function talkingTo(ps: Participant[]): string {
  if (ps.length === 0) return "someone new";
  if (ps.length === 1) return ps[0].name;
  const names = ps.map((p) => firstName(p.name));
  return ps.length === 2 ? names.join(" + ") : `${names.slice(0, 2).join(", ")} + ${ps.length - 2}`;
}

function Chip({ on, label, done, onClick }: { on: boolean; label: string; done?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-11 items-center gap-1.5 border px-4 text-body font-medium whitespace-nowrap ${on ? "border-fg bg-fg text-bg" : done ? "border-line text-muted" : "border-line text-fg"}`}
    >
      {done && <Check size={14} strokeWidth={2.5} aria-label="met earlier" />}
      {label}
    </button>
  );
}

function NameInput({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <input
      autoFocus
      aria-label="Their name"
      placeholder="their name"
      className={`${fieldClass} h-11 w-36 py-0 text-[15px]`}
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onDone(name.trim())}
      onBlur={() => onDone(name.trim())}
    />
  );
}

/** One big tap that unlocks the mic and the earbud together (iOS needs both inside a tap). */
function StartButton({ mic, resume, onStart }: { mic: MicState; resume: boolean; onStart: () => void }) {
  return (
    <div className="space-y-3">
      {mic === "blocked" && <Notice>Mic is blocked. Allow it for this site in your browser settings, then tap again.</Notice>}
      <Button className="min-h-16 w-full text-[17px]" onClick={onStart} disabled={mic === "starting"}>
        <Mic size={20} strokeWidth={2} aria-hidden />
        {mic === "starting" ? "Asking for the mic…" : mic === "blocked" ? "Try the mic again" : resume ? "Resume listening" : "Start listening"}
      </Button>
      <p className="text-center text-meta text-muted">Earbud in. Phone in hand. Act natural.</p>
    </div>
  );
}

/** "They just spoke, help me reply": a hint now, no matter what the coach thought. Thumb-sized, at the bottom. */
function NudgeButton({ onNudge }: { onNudge: () => void }) {
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (!asked) return;
    const t = setTimeout(() => setAsked(false), 1500); // same gap the server treats as one ask
    return () => clearTimeout(t);
  }, [asked]);
  return (
    <Button
      variant="secondary"
      className="min-h-16 w-full text-[17px]"
      disabled={asked}
      onClick={() => {
        setAsked(true);
        onNudge();
      }}
    >
      <MessageCircleQuestion size={20} strokeWidth={2} aria-hidden />
      {asked ? "On it…" : "Help me reply"}
    </Button>
  );
}

/** Before the first hint: lines to open with, from the dossier or general ones for strangers. */
function SayThis({ openers, listening }: { openers: string[]; listening: boolean }) {
  if (!openers.length) {
    return (
      <p data-testid="hint" className="font-serif text-[1.9rem] text-muted">
        {listening ? "Listening…" : "Who's here?"}
      </p>
    );
  }
  return (
    <section className="space-y-4" aria-label="Say this">
      <h2 className="text-meta font-semibold text-muted">Say this</h2>
      <ul className="space-y-4">
        {openers.map((o) => (
          <li key={o}>
            <Quote>{o}</Quote>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The whisper, set big enough to read at a glance mid-conversation. */
function Hint({ text }: { text: string }) {
  return (
    <p data-testid="hint" key={text} aria-live="polite" className="animate-hand-in font-serif text-[2.6rem] leading-[1.06] tracking-[-0.01em] text-balance">
      {text}
    </p>
  );
}

/** Last few lines only; older ones fade so the hint stays the focus. */
function Transcript({ lines }: { lines: Line[] }) {
  const recent = lines.slice(-4);
  if (!recent.length) return null;
  return (
    <ul className="space-y-1.5 text-body" aria-label="What's been said">
      {recent.map((l, i) => (
        <li
          key={l.id ?? `p${lines.length - recent.length + i}`}
          style={{ opacity: 0.35 + (0.65 * (i + 1)) / recent.length }}
          className={l.speaker === "me" ? "pl-10 text-right text-muted" : "pr-10"}
        >
          {l.text}
        </li>
      ))}
    </ul>
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
