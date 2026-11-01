// Chunk 1 · WebSocket adapter: wires a socket at LIVE_PATH to a LiveSession.
import type { Server } from "node:http";
import { ClientMsg, LIVE_PATH } from "@larp/shared";
import { WebSocket, WebSocketServer } from "ws";
import { listeners } from "../../listeners";
import { sessionFor, type LiveSession, type Transport } from "./session";

export function attachLive(server: Server): void {
  const wss = new WebSocketServer({ server, path: LIVE_PATH });
  wss.on("connection", (ws, req) => {
    const userId = new URL(req.url ?? "", "http://x").searchParams.get("user") || "demo";
    const transport: Transport = {
      json: (msg) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg)),
      binary: (chunk) => ws.readyState === WebSocket.OPEN && ws.send(chunk),
    };
    // Picked on the first message: `start {conversationId}` reattaches to a conversation still in progress.
    let session: LiveSession | null = null;
    // Control messages run in order (start must finish before say); audio bypasses the chain for speed.
    let chain = Promise.resolve();
    ws.on("message", (data, isBinary) => {
      if (isBinary) return session?.audio(data as Buffer);
      const parsed = ClientMsg.safeParse(safeJson(data.toString()));
      if (!parsed.success) return transport.json({ type: "error", message: "bad message" });
      const msg = parsed.data;
      session ??= sessionFor(userId, transport, listeners, msg.type === "start" ? msg.conversationId : undefined);
      chain = chain.then(() => session!.handle(msg)).catch((e) => console.error("[live]", e));
    });
    // Not the end of the conversation: the phone may be back in a moment (refresh, blip). It ends on stop.
    ws.on("close", () => void chain.then(() => session?.detach(transport)));
  });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
