// Chunk 1 · Emergency exit: a fake incoming call that gets you out of a conversation.
// Triggered by a code phrase ("is that my phone?") or the phone icon. It rings out loud,
// "Mom" says she needs you, and hanging up ends the chat like End does.
import { Phone, PhoneOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Line } from "./useLive";

const CALLER = "Mom";
const CLIP = "/escape-call.mp3";
/** Partials then the final of one sentence would each match; one call per this window. */
const COOLDOWN_MS = 30_000;

/** The code phrase. Natural to say, rare by accident, and it sets up the ring that follows. */
const PHRASE = /\b(is that|that's|thats|that is) my phone\b|\bmy phone('s| is) (ringing|buzzing|going off)\b/i;
export const isEscapePhrase = (text: string) => PHRASE.test(text);

/** Opens the call when anyone's latest line says the code phrase (speaker tags are too shaky to gate on). */
export function useEscapePhrase(lines: Line[], onPhrase: () => void) {
  const last = useRef(0);
  const latest = lines.at(-1)?.text ?? "";
  useEffect(() => {
    if (!isEscapePhrase(latest) || Date.now() - last.current < COOLDOWN_MS) return;
    last.current = Date.now();
    onPhrase();
  }, [latest]); // eslint-disable-line react-hooks/exhaustive-deps -- fire on new text only
}

interface Audio {
  ring: () => () => void;
  playClip: (url: string) => Promise<() => void>;
}

/** Full-screen incoming call. Decline goes back to the chat; hanging up after answering ends it. */
export function EscapeCall({ audio, onDecline, onHangUp }: { audio: Audio; onDecline: () => void; onHangUp: () => void }) {
  const [answered, setAnswered] = useState(false);
  const stopSound = useRef<() => void>(() => {});
  const elapsed = useCallTimer(answered);

  useEffect(() => {
    stopSound.current = audio.ring();
    return () => stopSound.current();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- ring once on open

  const answer = () => {
    stopSound.current();
    setAnswered(true);
    void audio.playClip(CLIP).then((stop) => (stopSound.current = stop), () => {});
  };

  return (
    <div role="dialog" aria-label={`Incoming call from ${CALLER}`} data-testid="escape-call" className="pt-safe pb-safe fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#1c1c1e] px-8 text-white">
      <div className="mt-20 space-y-2 text-center">
        <p className="text-[17px] text-white/60">{answered ? elapsed : "mobile"}</p>
        <p className="text-[2.6rem] font-light tracking-tight">{CALLER}</p>
      </div>
      <div className="mb-16 flex w-full justify-around">
        {answered ? (
          <CallButton label="End" color="bg-[#ff3b30]" onClick={onHangUp} icon={<PhoneOff size={30} />} />
        ) : (
          <>
            <CallButton label="Decline" color="bg-[#ff3b30]" onClick={onDecline} icon={<PhoneOff size={30} />} />
            <CallButton label="Accept" color="bg-[#34c759] animate-breathe" onClick={answer} icon={<Phone size={30} />} />
          </>
        )}
      </div>
    </div>
  );
}

function CallButton({ label, color, icon, onClick }: { label: string; color: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2">
      <span className={`flex size-[76px] items-center justify-center rounded-full ${color}`}>{icon}</span>
      <span className="text-[15px]">{label}</span>
    </button>
  );
}

/** m:ss since the call was answered. */
function useCallTimer(running: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}
