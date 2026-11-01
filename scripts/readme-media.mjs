// Regenerates the README visuals: phone screenshots + GIFs of the demo crowd, driven like a real user.
// Live lines go in through the demo type box (hidden from frames) since a headless browser can't talk.
// Usage: node scripts/readme-media.mjs [webUrl] [apiUrl]   (against scripts/dev-live.sh, never prod)
//   -> docs/media/journey.png + *.gif   (needs ffmpeg)
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, devices } from "playwright";

const web = process.argv[2] ?? "http://localhost:5201";
const apiBase = process.argv[3] ?? "http://localhost:3041";
const out = new URL("../docs/media/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "readme-media-"));

// Silent mic: the real STT stays connected but hears nothing, so only typed lines land.
const silence = join(tmp, "silence.wav");
execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "120", silence]);

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-audio-capture=${silence}`],
});
const user = `readme-${Date.now()}`;
const ctx = await browser.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 2, permissions: ["microphone"] });
// Headless taps leave no trace; draw a fading dot so viewers see what was tapped.
await ctx.addInitScript(() => {
  addEventListener("pointerdown", (e) => {
    if (document.documentElement.dataset.nodots) return;
    const dot = document.createElement("div");
    dot.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(255,106,26,.45);border:2px solid #FF6A1A;pointer-events:none;z-index:99999;transition:opacity .6s,transform .6s`;
    document.documentElement.append(dot);
    requestAnimationFrame(() => setTimeout(() => ((dot.style.opacity = "0"), (dot.style.transform = "scale(1.6)")), 250));
    setTimeout(() => dot.remove(), 1000);
  }, true);
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const settle = async (ms = 500) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
};
const shot = async (name) => {
  await settle(1100); // let tap dots fade
  await page.screenshot({ path: `${tmp}/${name}.png` }); // stills only feed the strip
  console.log(`shot ${name}`);
};

/** Grabs frames back to back until stopped; real timing, so the GIF shows real hint latency. */
function recorder() {
  const frames = [];
  let on = true;
  const loop = (async () => {
    while (on) frames.push({ buf: await page.screenshot({ type: "jpeg", quality: 85 }), t: Date.now() });
  })();
  return async (name, width = 360) => {
    on = false;
    await loop;
    const dir = mkdtempSync(join(tmp, `${name}-`));
    const list = frames.map((f, i) => {
      writeFileSync(join(dir, `${i}.jpg`), f.buf);
      const next = frames[i + 1]?.t ?? f.t + 1500; // hold the last frame
      return `file '${dir}/${i}.jpg'\nduration ${((next - f.t) / 1000).toFixed(3)}`;
    });
    writeFileSync(join(dir, "list.txt"), `${list.join("\n")}\nfile '${dir}/${frames.length - 1}.jpg'\n`);
    const filter = `fps=12,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", filter, "-loop", "0", `${out}${name}.gif`]);
    console.log(`gif ${name} (${frames.length} frames, ${((frames.at(-1).t - frames[0].t) / 1000).toFixed(1)}s)`);
  };
}

/** Says a line as if the mic heard it. */
async function say(text, who = "them") {
  const input = page.getByPlaceholder("type what someone says…");
  await page.evaluate(() => (document.documentElement.dataset.nodots = "1")); // the type box is hidden; so are its taps
  await input.fill(text);
  await page.getByRole("button", { name: who, exact: true }).click();
  await page.evaluate(() => delete document.documentElement.dataset.nodots);
}

// 1 · Welcome, then the demo crowd: pick who to meet, prep their dossiers.
await page.goto(`${web}/setup?user=${user}`);
await shot("1-welcome");
let stop = recorder();
await page.waitForTimeout(1500);
await page.getByText("Skip, use the demo crowd").click();
await page.getByRole("checkbox").first().waitFor();
await page.waitForTimeout(1800);
await page.getByText("Read the dossiers first").click();
await page.getByRole("tab", { name: /Prep/, selected: true }).waitFor();
await page.waitForTimeout(2200);
await page.getByRole("link", { name: /Sam Chen/ }).click();
await page.getByText("In common").waitFor();
await page.waitForTimeout(2800);
await stop("prep");
await page.goBack();
await page.getByText("Prepping").waitFor({ state: "detached", timeout: 90_000 });
await shot("2-prep");
await page.getByRole("link", { name: /Sam Chen/ }).click();
await page.getByText("In common").waitFor();
await shot("3-dossier");

// 2 · Live with Sam: a question gets a whispered hint, asking for the demo pops the link card.
await page.goto(`${web}/live?person=p-sam&event=evt-demo&user=${user}`);
await page.getByText("Talking to Sam Chen").waitFor();
await page.getByText("demo: type a line").click();
// The type box is a demo crutch; keep it clickable but out of the frames.
await page.addStyleTag({ content: `footer > div:has(input), footer > button[aria-pressed] { opacity: 0 !important; }` });
await settle();
stop = recorder();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Start listening/ }).click();
await page.getByRole("status").getByText("live").waitFor();
await page.waitForTimeout(1200);
await say("So what are you working on these days?");
await page.getByTestId("hint").waitFor({ timeout: 30_000 });
await page.waitForTimeout(3000);
await shot("4-hint");
await say("Love that. Do you have a demo I can check out?");
await page.getByText("tap to dismiss").waitFor();
await page.waitForTimeout(3000);
await shot("5-link-card");
await page.getByText("tap to dismiss").click();
await page.waitForTimeout(800);
await stop("live");
await say("I'll send you the deck tonight.", "me"); // a promise for the recap
await page.waitForTimeout(1500);

// 3 · Escape hatch: the code phrase fakes a call from Mom.
stop = recorder();
await page.waitForTimeout(600);
await say("Oh wait, is that my phone?", "me");
await page.getByTestId("escape-call").waitFor();
await page.waitForTimeout(2200);
await shot("6-escape");
await page.getByRole("button", { name: "Accept" }).click();
await page.waitForTimeout(2500);
await stop("escape");
await page.getByTestId("escape-call").getByRole("button", { name: "End" }).click();

// 4 · Recap: what you promised and the text to send.
await page.waitForURL(/\/events\//);
await page.getByRole("tab", { name: /Recap/ }).click();
await page.getByText("You promised").first().waitFor({ timeout: 60_000 });
await page.getByText("Writing up what happened").waitFor({ state: "detached", timeout: 60_000 });
await shot("7-recap");

// 5 · One strip for the README: before -> during -> after.
const strip = ["2-prep", "3-dossier", "4-hint", "5-link-card", "7-recap"];
const inputs = strip.flatMap((n) => ["-i", `${tmp}/${n}.png`]);
const scaled = strip.map((_, i) => `[${i}]scale=520:-1,pad=iw+40:ih:20:0:#070707[s${i}]`).join(";");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", `${scaled};${strip.map((_, i) => `[s${i}]`).join("")}hstack=inputs=${strip.length},pad=iw+40:ih+80:20:40:#070707`, `${out}journey.png`]);
console.log("strip journey");

await browser.close();
console.log(errors.length ? `page errors:\n${errors.join("\n")}` : "no page errors");
