// Chunk 1 · WebSocket adapter: wires a socket at LIVE_PATH to a LiveSession.
import type { Server } from "node:http";
import { ClientMsg, LIVE_PATH } from "@larp/shared";
import { WebSocket, WebSocketServer } from "ws";
import { listeners } from "../../listeners";
import { LiveSession } from "./session";

export function attachLive(server: Server): void {
  const wss = new WebSocketServer({ server, path: LIVE_PATH });
  wss.on("connection", (ws, req) => {
    const userId = new URL(req.url ?? "", "http://x").searchParams.get("user") || "demo";
    const session = new LiveSession(
      userId,
      {
        json: (msg) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg)),
        binary: (chunk) => ws.readyState === WebSocket.OPEN && ws.send(chunk),
      },
      listeners,
    );
    // Control messages run in order (start must finish before say); audio bypasses the chain for speed.
    let chain = Promise.resolve();
    ws.on("message", (data, isBinary) => {
      if (isBinary) return session.audio(data as Buffer);
      const parsed = ClientMsg.safeParse(safeJson(data.toString()));
      if (!parsed.success) return session.send({ type: "error", message: "bad message" });
      chain = chain.then(() => session.handle(parsed.data)).catch((e) => console.error("[live]", e));
    });
    ws.on("close", () => void chain.then(() => session.stop()));
  });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
