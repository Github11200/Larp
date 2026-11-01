// Live mode with a fake mic: checks the phone streams MIC_AUDIO PCM up the socket (no API keys needed).
// Usage: node scripts/mic-smoke.mjs [baseUrl] [wavFile]   (needs npm run dev)
// With a wav file (16-bit mono) and ELEVENLABS_API_KEY on the server, also waits for a transcript line.
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const wav = process.argv[3];
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
    ...(wav ? [`--use-file-for-fake-audio-capture=${wav}`] : []),
  ],
});
const page = await browser.newPage({ ...devices["Pixel 7"] });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

let audioBytes = 0;
const received = [];
page.on("websocket", (ws) => {
  ws.on("framesent", (f) => typeof f.payload !== "string" && (audioBytes += f.payload.length));
  ws.on("framereceived", (f) => typeof f.payload === "string" && received.push(JSON.parse(f.payload)));
});

await page.goto(`${base}/?user=mic-smoke-${Date.now()}`);
await page.getByText("Just show me the demo").click();
await page.getByText("Sam Chen").click();
await page.getByText("Talk to Sam").click();
await page.getByText("🎙").waitFor({ timeout: 5000 });
await page.waitForTimeout(wav ? 12000 : 2000);

const bytesPerSec = 16000 * 2;
console.log(`mic audio sent: ${audioBytes} bytes (~${(audioBytes / bytesPerSec).toFixed(1)}s of 16kHz PCM)`);
for (const m of received.filter((m) => m.type !== "transcript" || m.final)) console.log("  <-", JSON.stringify(m));
await browser.close();

if (errors.length) console.error("page errors:\n" + errors.join("\n"));
if (!audioBytes || errors.length) process.exit(1);
if (wav && !received.some((m) => m.type === "transcript")) {
  console.error("no transcript came back (is ELEVENLABS_API_KEY set on the server?)");
  process.exit(1);
}
console.log("mic smoke ok");
