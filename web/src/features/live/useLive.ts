// Chunk 1 · Client side of a live conversation (protocol in @larp/shared/live).
import { ServerMsg, type ClientMsg, type Link, type Speaker } from "@larp/shared";
import { useEffect, useRef, useState } from "react";
import { liveUrl } from "../../lib/api";
import { startMic, WhisperPlayer } from "./audio";

export interface Line {
  speaker: Speaker;
  text: string;
  final: boolean;
}

export function useLive(personId?: string) {
  const ws = useRef<WebSocket>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "ended">("connecting");
  const [lines, setLines] = useState<Line[]>([]);
  const [hint, setHint] = useState<string>();
  const [card, setCard] = useState<Link>();
  const [person, setPerson] = useState<string>();
  const [mic, setMic] = useState<"off" | "on" | "blocked">("off");
  const player = useRef<WhisperPlayer>(null);
  const stopMic = useRef<() => void>(null);

  useEffect(() => {
    const socket = new WebSocket(liveUrl());
    socket.binaryType = "arraybuffer";
    ws.current = socket;
    player.current = new WhisperPlayer();
    socket.onopen = () => send({ type: "start", personId });
    socket.onmessage = (e) => {
      if (typeof e.data !== "string") return player.current?.play(e.data);
      const msg = ServerMsg.parse(JSON.parse(e.data));
      switch (msg.type) {
        case "ready":
          setStatus("live");
          return void turnOnMic();
        case "transcript":
          return setLines((ls) => upsertLine(ls, msg));
        case "hint":
          player.current?.cut(); // newest hint wins
          return setHint(msg.text);
        case "link_card":
          return setCard(msg.link);
        case "person":
          return setPerson(msg.name);
        case "ended":
          return setStatus("ended");
        case "error":
          return console.warn("[live]", msg.message);
      }
    };
    return () => {
      socket.close();
      stopMic.current?.();
      stopMic.current = null;
      player.current?.close();
    };
  }, [personId]);

  /** Needs a user gesture on some browsers; if auto-start is refused, the page shows a mic button. */
  async function turnOnMic() {
    if (stopMic.current) return;
    try {
      const socket = ws.current;
      const stop = await startMic((pcm) => {
        // Always stream, even mid-whisper: they may keep talking. The server drops echoes of the coach.
        if (socket?.readyState !== WebSocket.OPEN) return;
        socket.send(pcm);
      });
      if (ws.current !== socket || socket?.readyState !== WebSocket.OPEN) return stop(); // page left while asking
      stopMic.current = stop;
      setMic("on");
    } catch (e) {
      console.warn("[live] mic", e);
      setMic("blocked");
    }
  }

  function send(msg: ClientMsg) {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg));
  }

  return {
    status,
    lines,
    hint,
    card,
    person,
    mic,
    turnOnMic,
    dismissCard: () => setCard(undefined),
    say: (speaker: Speaker, text: string) => send({ type: "say", speaker, text }),
    stop: () => send({ type: "stop" }),
  };
}

/** Partials replace the last in-progress line from the same speaker; finals lock it in. */
function upsertLine(lines: Line[], next: Line): Line[] {
  const last = lines.at(-1);
  if (last && !last.final && last.speaker === next.speaker) return [...lines.slice(0, -1), next];
  return [...lines, next];
}
