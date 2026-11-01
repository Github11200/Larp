// WEB_ORIGIN as pasted into the Render dashboard must not block our own site.
import { type AddressInfo } from "node:net";
import { expect, test, vi } from "vitest";

async function allowed(webOrigin: string, origin: string) {
  vi.resetModules();
  vi.stubEnv("WEB_ORIGIN", webOrigin);
  const { createApp } = await import("../src/app");
  const server = createApp().listen(0);
  try {
    const res = await fetch(`http://localhost:${(server.address() as AddressInfo).port}/health`, { headers: { origin } });
    return res.headers.get("access-control-allow-origin") === origin;
  } finally {
    server.close();
    vi.unstubAllEnvs();
  }
}

test("tolerates trailing slash, missing scheme, and caps", async () => {
  expect(await allowed("https://larp.example.com/", "https://larp.example.com")).toBe(true);
  expect(await allowed("Larp.Example.com", "https://larp.example.com")).toBe(true);
});

test("always allows the Render static site, blocks strangers", async () => {
  expect(await allowed("https://typo.example.com", "https://larp-web-x1y2.onrender.com")).toBe(true);
  expect(await allowed("https://larp.example.com", "https://evil.example.com")).toBe(false);
});

test("blank WEB_ORIGIN allows any origin", async () => {
  expect(await allowed("", "https://anything.example.com")).toBe(true);
});
