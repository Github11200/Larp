// Plays a scripted conversation against a running server and prints what the phone would receive.
// Usage: npm run sim              (local, http://localhost:3000)
//        npm run sim -- https://larp-api.onrender.com
import { api, LIVE_PATH, USER_HEADER, type ClientMsg } from "@larp/shared";
import WebSocket from "ws";

const base = process.argv[2] ?? "http://localhost:3000";
const user = "sim";
const script: ["me" | "them", string][] = [
  ["them", "Hey! What are you working on?"],
  ["me", "An earpiece that coaches you at networking events."],
  ["them", "That's wild. Do you have a demo I can see?"],
  ["me", "Yeah! I'll send you the deck after this."],
  ["them", "What's your LinkedIn?"],
];

await fetch(base + api.seedDemo.path, { method: "POST", headers: { [USER_HEADER]: user } });

const ws = new WebSocket(`${base.replace(/^http/, "ws")}${LIVE_PATH}?user=${user}`);
const t0 = Date.now();
const send = (m: ClientMsg) => ws.send(JSON.stringify(m));
let audioBytes = 0;

ws.on("message", (data, isBinary) => {
  if (isBinary) return void (audioBytes += (data as Buffer).length);
  const msg = JSON.parse(data.toString());
  if (msg.type === "transcript" && !msg.final) return;
  console.log(`+${String(Date.now() - t0).padStart(5)}ms`, msg.type.padEnd(10), JSON.stringify(msg));
  if (msg.type === "ended") {
    console.log(`whisper audio received: ${audioBytes} bytes`);
    ws.close();
  }
});

ws.on("open", async () => {
  send({ type: "start", personId: "p-sam" });
  for (const [speaker, text] of script) {
    await new Promise((r) => setTimeout(r, 1200));
    send({ type: "say", speaker, text });
  }
  await new Promise((r) => setTimeout(r, 1500));
  send({ type: "stop" });
});
