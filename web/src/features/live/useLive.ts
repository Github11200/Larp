// Chunk 1 · Client side of a live conversation (protocol in @larp/shared/live).
// The socket reconnects on its own and resumes the same conversation (refresh, blip, back-and-forth);
// only an explicit stop ends it.
import { ServerMsg, type ClientMsg, type Link, type Participant, type Speaker } from "@larp/shared";
import { useEffect, useRef, useState } from "react";
import { liveUrl } from "../../lib/api";
import { LiveAudio } from "./audio";

export interface Line {
  id?: string;
  speaker: Speaker;
  text: string;
  final: boolean;
}

export type LiveStatus = "connecting" | "ready" | "reconnecting" | "ended";
export type MicState = "off" | "starting" | "on" | "blocked";

/** The conversation this tab is in, so a refresh picks it back up. Per tab, like the conversation. */
const STORE = "larp.live";
interface Stored {
  id: string;
  /** The ?person it was opened with; opening live for someone else starts a new conversation. */
  person?: string;
}
const readStored = (): Stored | null => {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? "null") as Stored | null;
  } catch {
    return null;
  }
};
const writeStored = (s: Stored | null) => {
  try {
    if (s) sessionStorage.setItem(STORE, JSON.stringify(s));
    else sessionStorage.removeItem(STORE);
  } catch {
    // private mode: refresh just starts a new conversation
  }
};

/** `chosenEvent`: the event you went live from; the server falls back to the person's, else the newest. */
export function useLive(personId?: string, chosenEvent?: string) {
  const ws = useRef<WebSocket>(null);
  /** Lines, taps and End sent before the server is ready (slow connect, reconnect) wait here instead of vanishing. */
  const ready = useRef(false);
  const queue = useRef<ClientMsg[]>([]);
  const audio = useRef<LiveAudio>(null);
  const onEnded = useRef<() => void>(null);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [ears, setEars] = useState<boolean>();
  const [eventId, setEventId] = useState<string>();
  const [conversationId, setConversationId] = useState<string>();
  const [lines, setLines] = useState<Line[]>([]);
  const [hint, setHint] = useState<string>();
  const [openers, setOpeners] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [primaryId, setPrimaryId] = useState<string>();
  const [card, setCard] = useState<Link>();
  const [mic, setMic] = useState<MicState>("off");
  /** On a fake escape call: the coach goes quiet and stops listening, so the caller's voice isn't transcribed. */
  const held = useRef(false);

  useEffect(() => {
    audio.current = new LiveAudio();
    let closed = false; // this effect is done (unmount or stop); don't reconnect
    let retry: ReturnType<typeof setTimeout>;
    let attempt = 0;

    const connect = () => {
      const socket = new WebSocket(liveUrl());
      socket.binaryType = "arraybuffer";
      ws.current = socket;
      socket.onopen = () => {
        attempt = 0;
        const stored = readStored();
        const resume = stored && stored.person === personId ? stored.id : undefined;
        const start: ClientMsg = { type: "start", personId: resume ? undefined : personId, eventId: chosenEvent, conversationId: resume };
        socket.send(JSON.stringify(start));
      };
      socket.onmessage = (e) => {
        if (typeof e.data !== "string") return held.current ? undefined : audio.current?.play(e.data);
        const parsed = ServerMsg.safeParse(safeJson(e.data));
        if (!parsed.success) return console.warn("[live] unknown message", e.data); // newer server, older page
        onMessage(parsed.data);
      };
      socket.onclose = () => {
        ready.current = false;
        if (closed || ws.current !== socket) return;
        setStatus("reconnecting");
        retry = setTimeout(connect, Math.min(500 * 2 ** attempt++, 5000));
      };
    };

    const onMessage = (msg: ServerMsg) => {
      switch (msg.type) {
        case "ready":
          writeStored({ id: msg.conversationId, person: personId });
          setConversationId(msg.conversationId);
          ready.current = true;
          queue.current.splice(0).forEach(send);
          setEars(msg.ears ?? true);
          setEventId(msg.eventId);
          setLines([]); // the server replays the transcript right after
          return setStatus("ready");
        case "transcript":
          return setLines((ls) => upsertLine(ls, msg));
        case "hint":
          audio.current?.cut(); // newest hint wins
          return setHint(msg.text);
        case "link_card":
          return setCard(msg.link);
        case "participants":
          setParticipants(msg.participants);
          return setPrimaryId(msg.personId);
        case "openers":
          return setOpeners(msg.lines);
        case "ended":
          writeStored(null);
          onEnded.current?.();
          return setStatus("ended");
        case "error":
          return console.warn("[live]", msg.message);
      }
    };

    connect();
    return () => {
      closed = true;
      ready.current = false;
      queue.current = []; // never replay into the next person's conversation
      clearTimeout(retry);
      ws.current?.close(); // the server keeps the conversation for a bit in case we come back
      ws.current = null;
      audio.current?.close();
      setMic("off");
    };
  }, [personId, chosenEvent]);

  function send(msg: ClientMsg) {
    if (ready.current && ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg));
    else queue.current.push(msg);
  }

  /** The big Start tap. Must be called straight from the tap handler (iOS audio rules). */
  function start() {
    if (mic === "starting" || mic === "on") return;
    setMic("starting");
    // Stream to whichever socket is current, so the mic survives reconnects. Mid-whisper too:
    // they may keep talking; the server drops echoes of the coach.
    audio.current
      ?.start((pcm) => !held.current && ws.current?.readyState === WebSocket.OPEN && ws.current.send(pcm))
      .then(() => setMic("on"))
      .catch((e) => {
        console.warn("[live] mic", e);
        setMic("blocked");
      });
  }

  return {
    status,
    conversationId,
    ears,
    eventId,
    lines,
    hint,
    openers,
    participants,
    primaryId,
    card,
    mic,
    start,
    dismissCard: () => setCard(undefined),
    say: (speaker: Speaker, text: string) => send({ type: "say", speaker, text }),
    add: (who: { personId?: string; name?: string }) => send({ type: "add_participant", ...who }),
    remove: (who: { personId?: string; name?: string }) => send({ type: "remove_participant", ...who }),
    /** Resolves once the server has saved the conversation, so follow-ups exist when you look. */
    stop: () =>
      new Promise<void>((resolve) => {
        writeStored(null);
        onEnded.current = resolve;
        setTimeout(resolve, 3000); // don't strand the user if the socket is gone
        send({ type: "stop" });
      }),
    /** "They just spoke, tell me what to say." On-screen button, or an earbud button where the browser routes it. */
    nudge: () => send({ type: "nudge" }),
    /** Pause the coach (mic + whispers) for an escape call; `ring`/`playClip` play its audio. */
    hold: (on: boolean) => {
      held.current = on;
      if (on) audio.current?.cut();
    },
    ring: () => audio.current?.ring() ?? (() => {}),
    playClip: (url: string) => audio.current?.playClip(url) ?? Promise.resolve(() => {}),
  };
}

/** Finals with a known id replace that line (speaker fixes); otherwise a final locks in the in-progress line. */
function upsertLine(lines: Line[], next: Line): Line[] {
  const i = next.id ? lines.findIndex((l) => l.id === next.id) : -1;
  if (i >= 0) return lines.map((l, j) => (j === i ? next : l));
  const last = lines.at(-1);
  if (last && !last.final) return [...lines.slice(0, -1), next];
  return [...lines, next];
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
