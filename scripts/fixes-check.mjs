// Checks the link-card QR scans and that the demo shortcut never clobbers a real profile.
// Usage: node scripts/fixes-check.mjs [webUrl] [apiUrl]   (needs the dev servers running)
import { mkdirSync, readFileSync } from "node:fs";
import jsQR from "jsqr";
import { chromium, devices } from "playwright";
import { PNG } from "pngjs";

const base = process.argv[2] ?? "http://localhost:5173";
const apiUrl = process.argv[3] ?? "http://localhost:3000";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ ...devices["iPhone 13"] });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fail = (msg) => {
  console.error("FAIL", msg);
  process.exitCode = 1;
};

// 1. Link card QR: big and decodable, even downscaled (a camera ~1m away sees far fewer pixels).
await page.goto(`${base}/?user=qr-${Date.now()}`);
await page.getByText("Skip, use the demo crowd").click();
await page.getByText("Read the dossiers first").click();
await page.getByText("Sam Chen").click();
await page.getByText("Talk to Sam").click();
await page.getByRole("button", { name: "Type instead of talking" }).click();
const input = page.getByPlaceholder("type what someone says…");
await input.fill("Do you have a demo?");
await input.press("Enter");
const qr = page.getByTestId("link-qr");
await qr.waitFor();
const box = await qr.boundingBox();
console.log(`QR box ${Math.round(box.width)}x${Math.round(box.height)} css px on a ${page.viewportSize().width}px screen`);
if (box.width < 300) fail("QR smaller than 300 css px");
await page.screenshot({ path: `${shots}fix-qr.png` });
const png = PNG.sync.read(readFileSync(`${shots}fix-qr.png`));
for (const factor of [1, 4, 8]) {
  const img = downscale(png, factor);
  const code = jsQR(img.data, img.width, img.height);
  console.log(`decode at 1/${factor}: ${code?.data ?? "none"}`);
  if (!code) fail(`QR not decodable at 1/${factor}`);
}
await page.getByText("tap to dismiss").click();

// 2. Build a profile, then take the demo shortcut: my profile must survive.
const user = `keep-${Date.now()}`;
const headers = { "content-type": "application/json", "x-user-id": user };
const mine = { id: "me", name: "Nonit Real", headline: "Builds things", summary: "", skills: ["TS"], projects: [], links: [{ kind: "github", label: "GitHub", url: "https://github.com/real" }], status: "ready" };
await fetch(`${apiUrl}/api/profile`, { method: "PUT", headers, body: JSON.stringify(mine) });
await page.goto(`${base}/?user=${user}`);
const demoBtn = page.getByText(/Skip, use the demo crowd|Just show me the demo/).first();
if (await demoBtn.count()) {
  await demoBtn.click();
  await page.waitForTimeout(800);
} else {
  await fetch(`${apiUrl}/api/dev/seed`, { method: "POST", headers });
}
const after = await (await fetch(`${apiUrl}/api/profile`, { headers })).json();
console.log(`profile after demo shortcut: ${after?.name}`);
if (after?.name !== "Nonit Real") fail("demo shortcut overwrote the profile");
await page.screenshot({ path: `${shots}fix-after-demo.png` });

// 3. Polling survives dropped requests: kill the first two profile polls, the build still lands.
let dropped = 0;
let building = false;
await page.route("**/api/profile", (route) =>
  route.request().method() === "GET" && dropped < 2 && building ? (dropped++, route.abort()) : route.continue(),
);
await page.goto(`${base}/profile?user=poll-${Date.now()}`);
await page.getByPlaceholder(/github.com\/you/).fill("github.com/octocat\nI like cats");
building = true;
await page.getByRole("button", { name: "Learn me", exact: true }).click();
await page
  .getByText("This is what the coach knows about you")
  .waitFor({ timeout: 60000 })
  .catch(() => fail("profile never finished building"));
console.log(`profile built after ${dropped} dropped polls`);
if (dropped < 2) fail("didn't drop any polls; test proved nothing");
await page.screenshot({ path: `${shots}fix-profile-built.png` });

// 4. "Learn me again" with only a hobby keeps the name and skills it already had.
const nameBefore = await page.locator("h1").first().innerText();
await page.getByText("Add more about you").click();
await page.getByPlaceholder(/github.com\/you/).fill("I also go bouldering on weekends");
await page.getByRole("button", { name: "Learn me again" }).click();
await page.getByText("Learning you").waitFor();
await page.getByText("This is what the coach knows about you").waitFor({ timeout: 60000 });
const body = await page.locator("main, body").first().innerText();
console.log(`rebuild mentions bouldering: ${/boulder/i.test(body)}, still has HTML skill: ${/\bHTML\b/.test(body)}`);
const nameAfter = await page.locator("h1").first().innerText();
console.log(`rebuild: name ${nameBefore} -> ${nameAfter}`);
if (nameAfter !== nameBefore) fail("rebuild changed the name");
await page.screenshot({ path: `${shots}fix-profile-rebuilt.png`, fullPage: true });

// 5. Two quick edits (second fired while the first save is still in flight) both stick.
await page.route("**/api/profile", async (route) => {
  if (route.request().method() === "PUT") await new Promise((r) => setTimeout(r, 400)); // slow venue wifi
  await route.fallback();
});
await page.getByRole("button", { name: /^Edit headline/ }).click();
await page.getByRole("textbox", { name: "headline" }).fill("Quick edit one");
await page.keyboard.press("Enter");
await page.getByRole("button", { name: /^Edit name/ }).click();
await page.getByRole("textbox", { name: "name" }).fill("Quick Edit Two");
await page.keyboard.press("Enter");
await page.waitForTimeout(2000);
await page.reload();
await page.getByText("Quick Edit Two").waitFor();
const kept = await page.getByText("Quick edit one").count();
console.log(`quick edits both saved: ${kept > 0}`);
if (!kept) fail("first quick edit was lost");

await browser.close();
if (errors.length) fail("browser errors:\n" + errors.join("\n"));
console.log(process.exitCode ? "fixes check FAILED" : `fixes check ok, screenshots in ${shots}`);

/** Box-average downscale to simulate a camera that sees fewer pixels of the screen. */
function downscale(src, f) {
  const w = Math.floor(src.width / f), h = Math.floor(src.height / f);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) sum += src.data[((y * f + dy) * src.width + x * f + dx) * 4 + c];
        data[(y * w + x) * 4 + c] = sum / (f * f);
      }
  return { width: w, height: h, data };
}
