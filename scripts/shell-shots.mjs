// Walks the first-run flow on a phone and screenshots each screen for design review.
// Usage: node scripts/shell-shots.mjs [baseUrl]   (default http://localhost:5196) -> scripts/.shots/shell-*.png
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5196";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ ...devices["iPhone 13"] });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = async (name) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}shell-${name}.png` });
};

for (let i = 0; i < 30; i++) {
  try {
    await page.goto(`${base}/?user=shots-${Date.now()}`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
await page.getByText("Larp as the most prepared").waitFor();
await shot("1-welcome");

await page.getByText("Set me up").click();
await shot("2-you");
await page.getByText("Skip, I'll do this later").click();
await shot("3-event");
await page.goBack();
await page.goBack();
await page.getByText("Skip, use the demo crowd").click();
await page.getByRole("checkbox").first().waitFor();
await shot("4-pick");

await page.getByText("Read the dossiers first").click();
await page.getByText("Sam Chen").waitFor();
await shot("5-people");
await page.getByText("Sam Chen").click();
await page.waitForTimeout(1500);
await shot("6-person");
await page.goto(`${base}/followups`);
await shot("7-followups");
await page.goto(`${base}/profile`);
await shot("8-me");
await page.goto(`${base}/live`);
await shot("9-live");

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
