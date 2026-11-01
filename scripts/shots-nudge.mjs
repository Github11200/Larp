// Live screen "Help me reply": the button shows once live, a tap sends one nudge (repeat taps held off), and a hint lands.
// Usage: node scripts/shots-nudge.mjs [webUrl] [apiUrl]   -> scripts/.shots/nudge-*.png
// Run against a local in-memory server (scripts/dev-ports.sh), never prod data.
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const web = process.argv[2] ?? "http://localhost:5231";
const apiBase = process.argv[3] ?? "http://localhost:3061";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const user = `nudge-${Date.now()}`;
await fetch(`${apiBase}/api/dev/seed`, { method: "POST", headers: { "x-user-id": user } });
const browser = await chromium.launch({ channel: "chrome", args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const ctx = await browser.newContext({ ...devices["iPhone 13"], permissions: ["microphone"] });
const page = await ctx.newPage();
const errors = [];
const nudges = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(`${m.text()} ${m.location().url}`));
page.on("websocket", (ws) => ws.on("framesent", (f) => typeof f.payload === "string" && f.payload.includes('"nudge"') && nudges.push(Date.now())));

await page.goto(`${web}/live?person=p-sam&user=${user}`);
await page.getByText("Talking to Sam Chen").waitFor();
const start = page.getByRole("button", { name: "Start listening" });
if (await start.isVisible().catch(() => false)) await start.click();
const help = page.getByRole("button", { name: "Help me reply" });
await help.waitFor();
await page.screenshot({ path: `${shots}nudge-1-live.png` });

const input = page.getByPlaceholder("type what someone says…");
if (!(await input.isVisible())) await page.getByText("demo: type a line").click();
await input.fill("So what got you into hackathons?");
await page.getByRole("button", { name: "them", exact: true }).click();
await page.getByText("So what got you into hackathons?").waitFor();
const hintsBefore = await page.getByTestId("hint").innerText();

await help.click();
await page.getByRole("button", { name: "On it…" }).waitFor();
await page.screenshot({ path: `${shots}nudge-2-asked.png` });
await page.getByRole("button", { name: "On it…" }).click({ force: true }).catch(() => {}); // disabled: no second send
await help.waitFor({ timeout: 3000 }); // re-arms after the gap
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}nudge-3-hint.png` });
const hintAfter = await page.getByTestId("hint").innerText();

await browser.close();
if (nudges.length !== 1) errors.push(`expected 1 nudge sent, got ${nudges.length}`);
if (errors.length) {
  console.error("nudge UI failed:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`nudge ok: 1 sent, hint "${hintsBefore}" -> "${hintAfter}" -> ${shots}nudge-*.png`);
