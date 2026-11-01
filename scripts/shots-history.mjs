// Screenshots the People tab before/after the "skip ahead" demo button, plus one contact and follow-ups.
// Usage: node scripts/shots-history.mjs [baseUrl]   (default http://localhost:5183) -> scripts/.shots/history-*.png
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5183";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ ...devices["iPhone 13"] });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = async (name) => {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${shots}history-${name}.png`, fullPage: true });
};

// A profile + one prepped event, like right after the main demo (new users are sent to setup).
const user = `history-${Date.now()}`;
const api = process.env.API ?? "http://localhost:3013";
await fetch(`${api}/api/dev/seed`, { method: "POST", headers: { "x-user-id": user } });
await page.goto(`${base}/contacts?user=${user}`);
await page.getByText("Your people").waitFor();
await shot("1-before");
await page.getByRole("button", { name: /skip ahead/i }).click();
await page.getByText("Maya Chen").waitFor();
await shot("2-after");
await page.getByText("Maya Chen").click();
await page.getByText("Conversations").waitFor();
await shot("3-maya");
await page.goto(`${base}/followups`);
await shot("4-followups");
await browser.close();
console.log(errors.length ? `errors:\n${errors.join("\n")}` : "no console errors");
