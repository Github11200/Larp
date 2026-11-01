// Screenshots the People tab, a dossier, and the empty add-event form on a phone for design review.
// Usage: node scripts/shots-prep.mjs [baseUrl]   (default http://localhost:5196) -> scripts/.shots/prep-*.png
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
const shot = async (name, fullPage = false) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}prep-${name}.png`, fullPage });
};

await page.goto(`${base}/?user=shots-${Date.now()}`);
await page.getByText("Skip, use the demo crowd").click();
await page.getByText("Read the dossiers first").click();
await page.getByText("Sam Chen").waitFor();
await shot("1-people");
const box = await page.getByRole("button", { name: "New event" }).boundingBox();
console.log(`New event tap target ${Math.round(box.width)}x${Math.round(box.height)}`);

await page.getByRole("button", { name: "New event" }).click();
await shot("2-new-event");
await page.getByText("Never mind").click();

await page.getByText("Sam Chen").click();
await page.getByText("Say this").waitFor();
await shot("3-person");
await shot("3-person-full", true);

await page.goto(`${base}/setup/event?user=shots-empty-${Date.now()}`);
await page.getByText("Who's at your event?").waitFor();
await shot("5-setup-event");
await shot("5-setup-event-full", true);
// Main action should sit above the setup frame's fixed footer without scrolling.
const prep = await page.getByRole("button", { name: "Prep me" }).boundingBox();
const footer = await page.locator("footer").boundingBox();
console.log(`Prep me bottom ${Math.round(prep.y + prep.height)} vs footer top ${Math.round(footer.y)}`);

// Demo seeded from inside setup: people list renders in the setup frame; Jordan has no dossier yet.
await page.getByText("Just show me the demo").click();
await page.getByText("Jordan Lee").waitFor();
await shot("6-setup-seeded");
await page.getByText("Jordan Lee").click();
await page.getByText("Build dossier").waitFor();
await shot("4-person-nodossier");
await page.getByText("Build dossier").click();
await page.waitForTimeout(150);
await shot("4b-person-building");
// Fixture dossier (untouched by the picker) shows every section.
await page.goto(`${base}/people/p-sam`);
await page.getByText("Common ground").waitFor();
await shot("7-person-fixture-full", true);

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
