// Escape call: code phrase opens the fake call, Decline returns to the chat, the phone icon reopens it,
// Accept plays the caller, End leaves the chat. Run against a dev server.
// Usage: node scripts/escape-smoke.mjs [baseUrl]   (default http://localhost:5173)
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ ...devices["iPhone 13"] });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: `${shots}escape-${name}.png` });

await page.goto(`${base}/?user=escape-${Date.now()}`);
await page.getByText("Skip, use the demo crowd").click();
await page.getByText("Read the dossiers first").click();
await page.getByText("Sam Chen").click();
await page.getByText("Talk to Sam").click();
await page.getByText("Talking to Sam Chen").waitFor();
await page.getByText("demo: type a line").click();
const input = page.getByPlaceholder("type what someone says…");
await input.fill("oh wait, is that my phone?");
await page.getByRole("button", { name: "me", exact: true }).click();

const call = page.getByTestId("escape-call");
await call.waitFor();
await shot("1-ringing");
await page.getByText("Decline").click();
await call.waitFor({ state: "hidden" });

await page.getByLabel("Fake a call to get out").click();
await page.getByText("Accept").click();
await page.getByText("0:01").waitFor();
await shot("2-answered");
await page.getByText("End", { exact: true }).click();
await page.waitForURL(/\/events\//);
await shot("3-back-at-event");

await browser.close();
if (errors.length) {
  console.error("page errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("escape smoke ok");
