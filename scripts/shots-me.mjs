// Screenshots the Me tab states for design review.
// Usage: node scripts/shots-me.mjs [baseUrl]   (default http://localhost:5196) -> scripts/.shots/me-*.png
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
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${shots}me-${name}.png`, fullPage });
};

// Empty state, standalone tab and inside setup.
await page.goto(`${base}/profile?user=me-empty-${Date.now()}`);
await page.getByText("Who are you?").waitFor();
await shot("1-empty");
await page.goto(`${base}/setup/you?user=me-setup-${Date.now()}`);
await page.getByText("Who are you?").waitFor();
await shot("2-setup-you");
// Building state: submit notes and catch the pending screen.
await page.getByLabel("Links and anything else about you").fill("github.com/test, I play tennis");
await page.getByRole("button", { name: "Learn me" }).click();
await page.waitForTimeout(150);
await page.screenshot({ path: `${shots}me-2b-building.png` });

// Built profile via the demo crowd.
await page.goto(`${base}/?user=me-built-${Date.now()}`);
await page.getByText("Skip, use the demo crowd").click();
await page.getByRole("checkbox").first().waitFor();
await page.goto(`${base}/profile`);
await page.getByRole("button", { name: "Edit name" }).waitFor();
await shot("3-built");
await shot("4-built-full", true);

await page.getByRole("button", { name: "Edit headline" }).click();
await shot("5-edit-headline");
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Edit name" }).click();
await shot("6-edit-name");
await page.keyboard.press("Escape");

await page.getByText("Add more about you").click();
await page.getByText("Learn me again").scrollIntoViewIfNeeded();
await shot("7-more-open");

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
