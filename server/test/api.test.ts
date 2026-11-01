// REST contract smoke test: every chunk's routes respond with shapes matching @larp/shared.
import { type AddressInfo } from "node:net";
import { api, buildPath, USER_HEADER, type ResOf, type RouteDef } from "@larp/shared";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createApp } from "../src/app";

let base = "";
const server = createApp().listen(0);
beforeAll(() => {
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => void server.close());

async function call<D extends RouteDef>(def: D, opts: { params?: Record<string, string>; body?: unknown } = {}): Promise<ResOf<D>> {
  const res = await fetch(base + buildPath(def.path, opts.params), {
    method: def.method,
    headers: { "content-type": "application/json", [USER_HEADER]: "test-api" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  expect(res.status, `${def.method} ${def.path}`).toBe(200);
  return def.res.parse(await res.json()) as ResOf<D>;
}

const waitFor = async <T>(fn: () => Promise<T>, ok: (v: T) => boolean) => {
  for (let i = 0; i < 50; i++) {
    const v = await fn();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("timed out");
};

test("profile, prep, and follow-up routes", async () => {
  expect(await call(api.getProfile)).toBeNull();
  await call(api.seedDemo);
  expect((await call(api.getProfile))?.name).toBe("Alex Rivera");

  const event = await call(api.createEvent, { body: { guestList: "Ada Lovelace\nAlan Turing" } });
  expect(event.status).toBe("pending");
  await waitFor(() => call(api.getEvent, { params: { id: event.id } }), (e) => e.status === "ready");
  const people = await call(api.listPeople, { params: { id: event.id } });
  expect(people.map((p) => p.name).sort()).toEqual(["Ada Lovelace", "Alan Turing"]);

  const pending = await call(api.requestDossier, { params: { id: people[0].id } });
  expect(pending.dossierStatus).toBe("pending");
  const done = await waitFor(() => call(api.getPerson, { params: { id: people[0].id } }), (p) => p.dossierStatus === "ready");
  expect(done.dossier?.openers.length).toBeGreaterThan(0);

  expect(await call(api.listFollowUps)).toEqual([]);
  expect(await call(api.runNudges)).toEqual({ nudged: 0 });
});

test("bad input is a 400, missing doc is a 404", async () => {
  const bad = await fetch(base + api.createEvent.path, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  expect(bad.status).toBe(400);
  const missing = await fetch(base + buildPath(api.getPerson.path, { id: "nope" }));
  expect(missing.status).toBe(404);
});
