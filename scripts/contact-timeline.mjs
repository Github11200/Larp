// After a (typed) live chat with Sam from the demo crowd, Sam's People page shows the conversation + follow-up.
// Usage: node scripts/contact-timeline.mjs [baseUrl]   (default http://localhost:5221). Screenshot in scripts/.shots/.
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5221";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ ...devices["iPhone 13"] });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const T = { timeout: 60_000 };

try {
  await page.goto(`${base}/?user=timeline-${Date.now()}`);
  await page.getByText("Skip, use the demo crowd").click();
  await page.getByText("Read the dossiers first").click();
  await page.getByText("Sam Chen").click();
  await page.getByText("Talk to Sam").click();
  await page.getByText("Talking to Sam Chen").waitFor();
  await page.getByText("demo: type a line").click();
  const input = page.getByPlaceholder("type what someone says…");
  await input.fill("I'm building a tennis app, you should try it");
  await input.press("Enter");
  await input.fill("Sure, I'll send you the deck tomorrow");
  await page.getByRole("button", { name: "me", exact: true }).click();
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.getByRole("heading", { name: "You promised" }).waitFor(T);

  await page.getByRole("link", { name: "People", exact: true }).click();
  await page.getByText("Sam Chen").first().click();
  await page.getByText("Conversations").waitFor();
  await page.getByText("You haven't talked yet").waitFor({ state: "detached", timeout: 5000 });
  await page.waitForTimeout(500);
} catch (e) {
  errors.push(String(e));
}
await page.screenshot({ path: `${shots}contact-timeline.png`, fullPage: true });
await browser.close();
if (errors.length) {
  console.error("problems:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("contact timeline ok");
