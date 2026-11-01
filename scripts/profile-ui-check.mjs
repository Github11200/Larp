// Drives the Me screen end to end: upload a (fictional) resume PDF + notes, wait for the build, edit a field.
// Usage: node scripts/profile-ui-check.mjs [baseUrl]   (default http://localhost:5183). Screenshots in scripts/.shots/.
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5183";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });
const pdfPath = `${shots}resume.pdf`;

const browser = await chromium.launch({ channel: "chrome" });

// Fictional resume, rendered to PDF so the browser parser gets a real file.
const maker = await browser.newPage();
await maker.setContent(`<h1>Jordan Park</h1><p>jordan@example.com · github.com/octocat</p>
  <h2>Experience</h2><p>Software intern, Shopify — built checkout A/B testing tools in Ruby and React.</p>
  <h2>Projects</h2><p>PingPal — app that matches ping pong players nearby (React Native). Demo: https://pingpal.vercel.app</p>
  <h2>Skills</h2><p>TypeScript, React Native, Ruby, Postgres</p>`);
await maker.pdf({ path: pdfPath });

const page = await browser.newPage({ ...devices["iPhone 13"] });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: `${shots}profile-${name}.png`, fullPage: true });

await page.goto(`${base}/profile?user=profile-check-${Date.now()}`);
await page.getByText("Who are you?").waitFor();
await page.locator("input[type=file]").setInputFiles(pdfPath);
await page.getByText(/resume\.pdf|Couldn't read/).waitFor();
if (await page.getByText("Couldn't read").count()) throw new Error(`PDF parse failed: ${errors.join(" | ")}`);
await page.getByPlaceholder(/Links \+ anything else/).fill("linkedin.com/in/jordan-example. I play ping pong competitively.");
await shot("1-form");

const t = Date.now();
await page.getByRole("button", { name: "Learn me" }).click();
await page.getByText(/…$/).first().waitFor();
await shot("2-learning");
await page.getByText("Skills", { exact: false }).first().waitFor({ timeout: 60000 });
console.log(`built in ${Date.now() - t}ms`);
await shot("3-profile");

// Edit in place, then reload to prove it persisted.
const headline = page.locator("button").nth(1);
await headline.click();
await page.keyboard.press("ControlOrMeta+a");
await page.keyboard.type("Ping pong menace who ships");
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
await page.reload();
await page.getByText("Ping pong menace who ships").waitFor();
await shot("4-edited");

console.log("name:", await page.locator("button").first().textContent());
console.log("links:", await page.locator("select").count());
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
process.exit(errors.length ? 1 : 0);
