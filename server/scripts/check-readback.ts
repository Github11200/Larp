// Replays a prod conversation's lines through the read-back matcher to see which lines get credited to the user.
// Usage: npx tsx scripts/check-readback.ts <api> <user-id> <conversation-id>
import { repeatsHint, isEchoOfHint } from "../src/modules/live/session";
const [api, user, id] = process.argv.slice(2);
const all = await (await fetch(`${api}/api/conversations`, { headers: { "x-user-id": user } })).json();
const c = all.find((x: any) => x.id === id);
for (const u of c.transcript) {
  const prior = c.hints.filter((h: any) => h.at <= u.at);
  console.log(repeatsHint(u.text, prior, u.at) ? "READBACK" : isEchoOfHint(u.text, prior, u.at) ? "ECHO    " : "        ", u.speaker.padEnd(7), u.text);
}
