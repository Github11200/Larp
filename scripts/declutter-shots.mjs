// Screenshots the secondary screens (Me, person, People, contact, setup) for the declutter pass.
// Usage: node scripts/declutter-shots.mjs [baseUrl] [tag]   (default http://localhost:5201, "after")
//   -> scripts/.shots/declutter-<tag>-*.png
// Follow-up cards need a conversation: run `npm run sim -- http://localhost:3031` first (user "sim").
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5201";
const tag = process.argv[3] ?? "after";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
const newPage = async () => {
  const page = await browser.newPage({ ...devices["iPhone 13"] });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return page;
};
const shot = async (page, name, full = true) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${shots}declutter-${tag}-${name}.png`, fullPage: full });
};

const page = await newPage();
for (let i = 0; i < 30; i++) {
  try {
    await page.goto(`${base}/setup?user=declutter-${Date.now()}`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
await page.getByText("Larp as the most prepared").waitFor();
await shot(page, "1-welcome", false);
await page.goto(`${base}/setup/you`);
await shot(page, "2-setup-you");
await page.goto(`${base}/setup`);
await page.getByText("Skip, use the demo crowd").click();
await page.getByRole("checkbox").first().waitFor();

await page.goto(`${base}/profile`);
await page.getByText("Alex Rivera").first().waitFor();
await shot(page, "3-me");
// Edit mode: rename a project and check it saved.
await page.getByRole("button", { name: "Edit", exact: true }).click();
await shot(page, "3b-me-editing");
await page.getByRole("button", { name: /Edit project name: Rally/ }).click();
await page.getByRole("textbox", { name: "project name" }).fill("Rally Club");
await page.keyboard.press("Enter");
await page.getByRole("button", { name: "Done" }).click();
await page.getByText("Rally Club").waitFor();
await page.reload();
await page.getByText("Rally Club").waitFor();
console.log("profile edit saved");
await page.goto(`${base}/people/p-sam`);
await page.getByText("Sam Chen").first().waitFor();
await shot(page, "4-person");
await page.goto(`${base}/contacts`);
await page.getByText("Sam Chen").first().waitFor();
await shot(page, "5-people");
await page.getByText("Sam Chen").first().click();
await page.waitForURL(/\/contacts\/.+/);
await shot(page, "6-contact");

// A user with a finished conversation, if the sim has run.
const sim = await newPage();
await sim.goto(`${base}/followups?user=sim`);
await shot(sim, "7-followups");
await sim.goto(`${base}/contacts`);
await sim.waitForTimeout(1500);
const someone = sim.locator("a[href^='/contacts/']").first();
if (await someone.count()) {
  await someone.click();
  await sim.waitForURL(/\/contacts\/.+/);
  await shot(sim, "8-contact-talked");
}

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
