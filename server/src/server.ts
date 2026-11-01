// Render Web Service entrypoint: REST API + live WebSocket on one port.
import { createServer } from "node:http";
import { createApp } from "./app";
import { env } from "./env";
import { attachLive } from "./modules/live/socket";

const server = createServer(createApp());
attachLive(server);
server.listen(env.port, () => {
  console.log(`api on :${env.port}`);
  console.log(`store=${env.databaseUrl ? "postgres" : "memory"} queue=${env.redisUrl ? "keyvalue" : "inline"}`);
  console.log(`elevenlabs=${env.elevenLabsKey ? "on" : "off"}`);
});
