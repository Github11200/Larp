// Screenshots live mode states on a phone: mic blocked/start, listening with a hint.
// Usage: node scripts/shots-live.mjs [baseUrl]   -> scripts/.shots/live-*.png
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5196";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });

async function session(name, permissions) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], permissions });
  const page = await ctx.newPage();
  await page.goto(`${base}/?user=live-${name}-${Date.now()}`);
  await page.getByText("Skip, use the demo crowd").click();
  await page.getByText("Read the dossiers first").click();
  await page.getByText("Sam Chen").click();
  await page.getByText("Talk to Sam").click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${shots}live-${name}.png` });
  return page;
}

await session("nomic", []);
const page = await session("mic", ["microphone"]);
await page.getByRole("button", { name: "Type instead of talking" }).click();
await page.getByPlaceholder("type what someone says…").fill("What are you working on these days?");
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Priya" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${shots}live-hint.png` });
await browser.close();
