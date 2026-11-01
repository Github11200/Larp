// Contacts + events UI check: two events sharing a person -> one contact, switch events, cancel, quick-add, bad link.
// Usage: node scripts/contacts-smoke.mjs [baseUrl]   (default http://localhost:5221). Screenshots in scripts/.shots/.
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5221";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ ...devices["iPhone 13"] });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
page.on("dialog", (d) => void d.accept());
const shot = (name) => page.screenshot({ path: `${shots}contacts-${name}.png`, fullPage: true });
const T = { timeout: 60_000 };

const prep = async (names) => {
  await page.getByPlaceholder(/Sam Chen - Founder/).fill(names);
  await page.getByText("Prep me").click();
};

try {
  // New user: first event goes through guided setup.
  await page.goto(`${base}/setup/event?user=contacts-smoke-${Date.now()}`);
  await prep("Sam Chen - Founder, VoiceKit linkedin.com/in/sam-chen\nAda Lovelace - Analyst");
  await page.getByText("Ada Lovelace").waitFor(T);

  // Home shows the newest event. New event -> Cancel goes back.
  await page.goto(`${base}/`);
  await page.getByRole("heading", { name: /Mystery mixer/ }).waitFor(T);
  await page.getByRole("button", { name: "New event" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByText("Ada Lovelace").waitFor();

  // Second event with an overlapping person.
  await page.getByRole("button", { name: "New event" }).click();
  await prep("sam chen\nGrace Hopper - Admiral");
  await page.getByText("Grace Hopper").waitFor(T);
  await page.getByRole("heading", { name: /#2/ }).waitFor();
  await shot("1-event-b");

  // Switch to the first event.
  await page.getByText(/All events · 2/).click();
  await page.getByText("Coming up").waitFor();
  await shot("2-events-list");
  await page.locator("a[href^='/events/']").filter({ hasNotText: "#2" }).first().click();
  await page.getByText("Ada Lovelace").waitFor();

  // People tab: Sam is one contact seen at two events.
  await page.getByRole("link", { name: "People", exact: true }).click();
  await page.getByText("Seen at 2 events").waitFor(T);
  await shot("3-people");
  await page.getByText("Sam Chen").click();
  await page.getByText("Seen at", { exact: true }).waitFor();
  if ((await page.locator("a[href^='/events/']").count()) !== 2) errors.push("Sam's contact page should list 2 events");
  await shot("4-contact");

  // Quick-add someone off the list.
  await page.getByRole("link", { name: "People" }).first().click();
  await page.getByText("Met someone not on the list?").click();
  await page.getByPlaceholder("The person from the snack table").fill("Mo Salah");
  await page.getByPlaceholder("Wants the deck, loves F1").fill("Wants the deck");
  await page.getByText("Save them").click();
  await page.getByRole("link", { name: /Mo Salah/ }).waitFor();
  await shot("5-quick-add");

  // Bad link: an error with a way forward, not a fake event.
  await page.goto(`${base}/?new=1`);
  await page.getByPlaceholder("lu.ma/…, eventbrite, whatever").fill(`https://lu.ma/not-a-real-event-${Date.now()}`);
  await page.getByText("Prep me").click();
  await page.getByText(/Couldn't read that link/).waitFor(T);
  await shot("6-bad-link");

  // Dead links get friendly copy.
  await page.goto(`${base}/people/nope`);
  await page.getByText("This person left the chat.").waitFor();

} catch (e) {
  await shot("fail");
  errors.push(String(e));
}
await browser.close();
if (errors.length) {
  console.error("problems:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`contacts smoke ok, screenshots in ${shots}`);
