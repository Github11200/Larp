// Drives the after-the-event flow on a phone: talk to Sam -> follow-up written -> edit -> nudge -> mark sent,
// plus an unnamed chat that becomes notes and gets labelled. Needs the api + web dev servers running.
// Usage: node scripts/followups-ui.mjs [baseUrl]   (screenshots in scripts/.shots/followups-*.png)
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(`${m.text()} ${m.location().url}`));
const shot = (name) => page.screenshot({ path: `${shots}followups-${name}.png`, fullPage: true });

async function talk(lines) {
  await page.getByRole("button", { name: "Type instead of talking" }).click();
  const input = page.getByPlaceholder("type what someone says…");
  for (const [speaker, text] of lines) {
    await input.fill(text);
    await page.getByRole("button", { name: speaker, exact: true }).click();
  }
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.getByRole("heading", { name: "Follow-ups", level: 1 }).waitFor();
}
const written = () => page.getByText("Writing up what happened…").first().waitFor({ state: "detached", timeout: 30000 });

await page.goto(`${base}/?user=fu-${Date.now()}`);
await page.getByText("Skip, use the demo crowd").click();
await page.getByText("Read the dossiers first").click();
await page.getByText("Sam Chen").click();
await page.getByText("Talk to Sam").click();
await page.getByText("Talking to Sam Chen").waitFor();
await talk([
  ["them", "So what are you building?"],
  ["me", "An earpiece that whispers what to say. I'll send you the deck tomorrow."],
  ["them", "Love it. I can intro you to our CTO, she's deep in voice."],
]);
await page.getByRole("heading", { name: "Sam Chen" }).waitFor();
await written();
await page.getByRole("heading", { name: "You promised" }).waitFor();
await shot("1-written");

// Edit the draft and save it.
await page.getByRole("button", { name: "Edit" }).click();
const box = page.getByLabel("Draft message");
await box.fill((await box.inputValue()) + "\nPS: rematch at tennis?");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByText("PS: rematch at tennis?").waitFor();
await page.getByRole("button", { name: "Copy" }).click();
await page.getByRole("button", { name: "Copied" }).waitFor();

// An unnamed chat: notes only, then "who was this?".
await page.getByRole("link", { name: "Go live" }).click();
await talk([
  ["them", "Hey I'm Dana, I'm building robot baristas."],
  ["me", "No way. I’ll send you my GitHub."],
]);
await page.getByRole("heading", { name: "Who was this?" }).waitFor();
await written();
await shot("2-notes");
await page.getByPlaceholder("Name, or names if a group").fill("Dana");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByRole("heading", { name: "Dana" }).waitFor();
await written();

// A week later: nudges + tab badge.
await page.getByText("Skip to a week later").click();
await page.getByTestId("due-now").getByText(/You told Sam you'd/).waitFor();
await page.getByTestId("nudge-badge").waitFor();
await shot("3-nudged");
await page.screenshot({ path: `${shots}followups-3b-top.png` });

await page.locator("article", { has: page.getByRole("heading", { name: "Sam Chen" }) }).getByRole("button", { name: "Mark sent" }).click();
await page.getByText("sent. Networking legend.").waitFor();
await shot("4-sent");

await browser.close();
if (errors.length) {
  console.error("browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`followups ui ok, screenshots in ${shots}`);
