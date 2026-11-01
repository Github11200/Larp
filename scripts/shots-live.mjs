// Drives live mode on a phone through the real cases: 1:1 prepped, stranger whose name gets caught,
// a 3-person group, and a refresh mid-conversation (must continue the same conversation).
// Usage: node scripts/shots-live.mjs [webUrl] [apiUrl]   -> scripts/.shots/live-*.png
// Run against scripts/dev-live.sh (in-memory store), never against prod data.
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const web = process.argv[2] ?? "http://localhost:5201";
const apiBase = process.argv[3] ?? "http://localhost:3041";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const errors = [];

async function open(name, path) {
  const user = `live-${name}-${Date.now()}`;
  await fetch(`${apiBase}/api/dev/seed`, { method: "POST", headers: { "x-user-id": user } });
  const ctx = await browser.newContext({ ...devices["iPhone 13"], permissions: ["microphone"] });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(`${web}${path}${path.includes("?") ? "&" : "?"}user=${user}`);
  const shot = (s) => page.screenshot({ path: `${shots}live-${name}-${s}.png` });
  const type = async (text, who = "them") => {
    const input = page.getByPlaceholder("type what someone says…");
    if (!(await input.isVisible())) await page.getByText("demo: type a line").click();
    await input.fill(text);
    await page.getByRole("button", { name: who, exact: true }).click();
  };
  const conversations = async () =>
    (await fetch(`${apiBase}/api/conversations`, { headers: { "x-user-id": user } }).then((r) => r.json()));
  return { page, shot, type, conversations };
}

// 1 · 1:1 with someone prepped
{
  const { page, shot, type } = await open("prepped", "/live?person=p-sam");
  await page.getByText("Talking to Sam Chen").waitFor();
  await page.getByText("How do you get speech latency under 200ms?").waitFor();
  await shot("1-prestart");
  await page.getByRole("button", { name: "Start listening" }).click();
  await page.getByRole("status").getByText("live").waitFor();
  await shot("2-listening");
  await type("Do you have a demo?");
  await page.getByText("tap to dismiss").waitFor();
  await shot("3-card");
  await page.getByText("tap to dismiss").click();
  await page.getByTestId("hint").waitFor();
  await shot("4-hint");
}

// 2 · stranger: the name is caught from a typed line and matched to an attendee
{
  const { page, shot, type, conversations } = await open("stranger", "/live");
  await page.getByText("Talking to someone new").waitFor();
  await page.getByText("terrible at names").waitFor();
  await shot("1-prestart");
  await type("Hey! I'm Mati, what's your name?");
  await page.getByText("Talking to Mati").waitFor();
  await type("Oh and this is my friend Priya");
  await page.getByText("Talking to Mati + Priya").waitFor();
  await page.getByText("That's Priya.").waitFor();
  await shot("2-caught");
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.waitForURL(/followups/);
  const [c] = await conversations();
  if (c.participants.length !== 2 || c.personId !== "p-priya" || c.eventId !== "evt-demo") throw new Error(`stranger saved wrong: ${JSON.stringify(c)}`);
}

// 3 · group of three: two tapped from the event, one stranger added by name
{
  const { page, shot, type } = await open("group", "/live");
  await page.getByRole("button", { name: "Sam", exact: true }).click();
  await page.getByRole("button", { name: "Priya", exact: true }).click();
  await page.getByRole("button", { name: "someone new" }).click();
  await page.getByLabel("Their name").fill("Lena");
  await page.getByLabel("Their name").press("Enter");
  await page.getByText("Talking to Sam, Priya + 1").waitFor();
  await shot("1-picked");
  await type("So what are you all building?");
  await page.waitForTimeout(1500);
  await shot("2-chat");
}

// 4 · refresh mid-conversation continues the same conversation
{
  const { page, shot, type, conversations } = await open("refresh", "/live?person=p-priya");
  await type("How long have you been doing ML?");
  await page.getByText("How long have you been doing ML?").waitFor();
  await page.reload();
  await page.getByText("How long have you been doing ML?").waitFor();
  await page.getByText("Talking to Priya Patel").waitFor();
  await type("Since college, mostly evals now.", "me");
  await shot("1-after-refresh");
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.waitForURL(/followups/);
  const all = await conversations();
  if (all.length !== 1 || all[0].transcript.length !== 2) throw new Error(`refresh split the conversation: ${JSON.stringify(all.map((c) => c.transcript.length))}`);
}

await browser.close();
if (errors.length) {
  console.error("browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`live shots ok -> ${shots}live-*.png`);
