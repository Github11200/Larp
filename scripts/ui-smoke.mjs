// Clicks through the whole app on a phone-sized screen against `npm run dev`.
// Usage: node scripts/ui-smoke.mjs [baseUrl]   (default http://localhost:5173)
// Screenshots land in scripts/.shots/ (gitignored).
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ ...devices["iPhone 13"] });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(`${m.text()} ${m.location().url}`));
const shot = (name) => page.screenshot({ path: `${shots}${name}.png` });

// Fresh user each run so state from earlier runs doesn't leak in.
await page.goto(`${base}/?user=smoke-${Date.now()}`);
// New users land in guided setup; take the demo-crowd shortcut.
await page.getByText("Skip, use the demo crowd").click();
await page.getByText("Read the dossiers first").click();
// Lands on the event hub, Prep stage.
await page.getByText("Sam Chen").waitFor();
await page.getByRole("tab", { name: /Prep/, selected: true }).waitFor();
await shot("1-hub-prep");

await page.getByText("Sam Chen").click();
await page.getByText("Talk to Sam").waitFor();
await shot("2-person");

await page.getByText("Talk to Sam").click();
await page.getByText("Talking to Sam Chen").waitFor();
await page.getByTestId("live-event").filter({ hasText: "Demo Night" }).waitFor(); // live knows which event you're at
await page.getByText("demo: type a line").click();
const input = page.getByPlaceholder("type what someone says…");
await input.fill("Do you have a demo?");
await input.press("Enter");
await page.getByText("Larp Coach demo").waitFor();
await shot("3-linkcard");
await page.getByText("tap to dismiss").click();
await page.getByTestId("hint").filter({ hasNotText: "Listening…" }).waitFor(); // stub or real LLM hint
await input.fill("Sure, I'll send you the deck");
await page.getByRole("button", { name: "me", exact: true }).click();
await shot("4-live");

// End returns to the event: the chat shows up under Live, then its follow-up under Recap.
await page.getByRole("button", { name: "End chat" }).click();
await page.getByText(/Tonight so far/).waitFor();
await shot("5-hub-live");
await page.getByRole("tab", { name: /Recap/ }).click();
await page.getByText("Skip to a week later").click();
await page.getByTestId("due-now").waitFor();
await shot("6-recap");

await browser.close();
if (errors.length) {
  console.error("browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`ui smoke ok, screenshots in ${shots}`);
