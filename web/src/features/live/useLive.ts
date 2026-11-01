// Chunk 1 · Client side of a live conversation (protocol in @larp/shared/live).
import { ServerMsg, type ClientMsg, type Link, type Speaker } from "@larp/shared";
import { useEffect, useRef, useState } from "react";
import { liveUrl } from "../../lib/api";

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

  useEffect(() => {
    const socket = new WebSocket(liveUrl());
    socket.binaryType = "arraybuffer";
    ws.current = socket;
    socket.onopen = () => send({ type: "start", personId });
    socket.onmessage = (e) => {
      // TODO(chunk 1): binary frames are whisper audio (WHISPER_AUDIO); queue them into an AudioContext.
      if (typeof e.data !== "string") return;
      const msg = ServerMsg.parse(JSON.parse(e.data));
      switch (msg.type) {
        case "ready":
          return setStatus("live");
        case "transcript":
          return setLines((ls) => upsertLine(ls, msg));
        case "hint":
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
    return () => socket.close();
  }, [personId]);

  // TODO(chunk 1): mic capture -> MIC_AUDIO PCM -> ws.current.send(binary).

  function send(msg: ClientMsg) {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg));
  }

  return {
    status,
    lines,
    hint,
    card,
    person,
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
