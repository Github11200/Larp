// Walks one event end to end (prep -> live -> recap) on a phone and screenshots each screen, full page.
// Usage: node scripts/flow-shots.mjs [baseUrl]   (default http://localhost:5200) -> scripts/.shots/flow-*.png
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5200";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ ...devices["iPhone 13"] });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = async (name, fullPage = true) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shots}flow-${name}.png`, fullPage });
};

/** One typed conversation in live mode, then End. */
async function chat(lines) {
  await page.getByText("demo: type a line").click();
  const input = page.getByPlaceholder("type what someone says…");
  for (const [who, text] of lines) {
    await input.fill(text);
    if (who === "me") await page.getByRole("button", { name: "me", exact: true }).click();
    else await input.press("Enter");
    await page.waitForTimeout(300);
    const card = page.getByRole("button", { name: /Tap to dismiss/ });
    if (await card.isVisible()) {
      await page.waitForTimeout(600);
      await card.click();
    }
  }
}

await page.goto(`${base}/setup/event?user=flow-${Date.now()}`);
await shot("0-setup-event");
await page.goto(`${base}/setup`);
await page.getByText("Skip, use the demo crowd").click();
await page.getByRole("checkbox").first().waitFor();
await shot("1-pick");
await page.getByText("Read the dossiers first").click();
await page.getByRole("tab", { name: /Prep/, selected: true }).waitFor();
await shot("2-prep");

await page.getByRole("tab", { name: /Live/ }).click();
await shot("3-live-empty");

// Chat 1 with Sam, from the Live stage row.
await page.getByRole("link", { name: /Sam Chen/ }).click();
await page.getByText("Talking to Sam Chen").waitFor();
await chat([["them", "Do you have a demo?"], ["me", "Sure, I'll send you the deck"]]);
await shot("4-live-sam", false);
await page.getByRole("button", { name: "End chat" }).click();
await page.getByText(/Tonight so far/).waitFor();
await shot("5-live-after-sam");

// Chat 2 with a stranger: Sam should now show as met.
await page.getByRole("link", { name: /Start a conversation/ }).click();
await page.getByTestId("live-event").filter({ hasText: "1 of" }).waitFor();
await shot("6-live-stranger", false);
await chat([["them", "Hey! I'm Mati, I run a robotics club."], ["me", "Nice, I'll send you my GitHub"]]);
await page.getByRole("button", { name: "End chat" }).click();
await page.getByText(/Tonight so far · 2/).waitFor();
await page.waitForTimeout(2500);
await shot("7-live-two-chats");

await page.getByRole("tab", { name: /Recap/ }).click();
await page.waitForTimeout(1500);
await shot("8-recap");

await page.goto(`${base}/events`);
await shot("9-events");
await page.goto(`${base}/events/new`);
await shot("10-new-event");
await page.goto(`${base}/`);
await page.waitForURL(/\/events\//);
await shot("11-home");

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
