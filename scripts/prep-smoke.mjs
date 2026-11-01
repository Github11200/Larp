// Chunk 4 UI check: paste a real Luma link, see the people list, open someone, build a dossier.
// Usage: node scripts/prep-smoke.mjs [baseUrl] [lumaUrl]   Screenshots land in scripts/.shots/.
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5273";
const luma = process.argv[3] ?? "https://lu.ma/4757x124";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ ...devices["iPhone 13"] });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = (name) => page.screenshot({ path: `${shots}prep-${name}.png`, fullPage: true });

// Fresh user lands in guided setup; jump to its event step.
await page.goto(`${base}/setup/event?user=prep-smoke-${Date.now()}`);
await page.getByPlaceholder("Event link").fill(luma);
await shot("1-add");
await page.getByText("Prep me").click();
await page.getByText("New event").waitFor({ timeout: 60_000 });
await page.locator("a[href^='/people/']").first().waitFor({ timeout: 60_000 });
// Photos come from the event's CDN; failed ones fall back to initials, slow ones get 10s.
const loaded = () => page.$$eval("a[href^='/people/'] img", (imgs) => imgs.every((i) => i.complete));
for (let i = 0; i < 20 && !(await loaded()); i++) await page.waitForTimeout(500);
const photos = await page.locator("a[href^='/people/'] img").count();
if (!(await loaded())) errors.push("avatars still loading after 10s");
await shot("2-people");
const count = await page.locator("a[href^='/people/']").count();

await page.locator("a[href^='/people/']").first().click();
await page.getByText("Build dossier").click();
await page.getByText("Say this").waitFor({ timeout: 90_000 }).catch(async (e) => {
  await shot("3-dossier-failed");
  throw e;
});
await shot("3-dossier");

await browser.close();
console.log(`people: ${count}, photos: ${photos}`);
if (errors.length) {
  console.error("browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`prep smoke ok, screenshots in ${shots}`);
