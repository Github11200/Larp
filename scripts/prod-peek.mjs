// Read-only screenshots of a prod user's screens, to see what they see.
// Usage: node scripts/prod-peek.mjs <user> <path> [<path>...]   -> scripts/.shots/peek-<n>.png
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const [user, ...routes] = process.argv.slice(2);
const base = process.env.WEB ?? "https://larp-web.onrender.com";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ ...devices["iPhone 13"] });
for (const [i, r] of routes.entries()) {
  await page.goto(`${base}${r}${r.includes("?") ? "&" : "?"}user=${user}`);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${shots}peek-${i}.png`, fullPage: true });
}
await browser.close();
console.log(`saved ${routes.length} to ${shots}`);
