// Screenshot a reference site (desktop + phone, full page) and dump its fonts/colors.
// Usage: node scripts/ref-shot.mjs <url> [outName]   -> scripts/.shots/ref-<outName>-*.png
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const url = process.argv[2];
const name = process.argv[3] ?? "site";
const shots = new URL("./.shots/", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
for (const [label, ctx] of [["phone", devices["iPhone 13"]], ["desktop", { viewport: { width: 1440, height: 900 } }]]) {
  const page = await browser.newPage(ctx);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${shots}ref-${name}-${label}.png`, fullPage: true });
  await page.screenshot({ path: `${shots}ref-${name}-${label}-fold.png` });
  await page.evaluate(() => window.scrollTo(0, 1100));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${shots}ref-${name}-${label}-fold2.png` });
  if (label === "desktop") {
    const style = await page.evaluate(() => {
      const seen = { fonts: new Set(), colors: new Set(), bgs: new Set() };
      for (const el of document.querySelectorAll("body, body *")) {
        const s = getComputedStyle(el);
        seen.fonts.add(s.fontFamily);
        seen.colors.add(s.color);
        if (s.backgroundColor !== "rgba(0, 0, 0, 0)") seen.bgs.add(s.backgroundColor);
      }
      return { fonts: [...seen.fonts], colors: [...seen.colors].slice(0, 20), bgs: [...seen.bgs].slice(0, 20), text: document.body.innerText.slice(0, 1500) };
    });
    console.log(JSON.stringify(style, null, 2));
  }
  await page.close();
}
await browser.close();
