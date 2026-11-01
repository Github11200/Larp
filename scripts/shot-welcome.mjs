// Screenshots the Welcome screen (has a coached-line Quote) for a font check.
// Usage: node scripts/shot-welcome.mjs [baseUrl] -> scripts/.shots/welcome.png
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ ...devices["iPhone 13"] });
await page.goto(`${base}/?user=font-check-${Date.now()}`);
await page.locator("q").first().waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}welcome.png` });
console.log(`${shots}welcome.png`);
await browser.close();
