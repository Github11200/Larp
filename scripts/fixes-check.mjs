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
