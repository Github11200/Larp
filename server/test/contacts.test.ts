// Contacts layer + prep robustness: one human across events, re-prep keeps dossiers, bad links fail loudly.
// Test
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { type AddressInfo } from "node:net";
import { api, buildPath, USER_HEADER, type ResOf, type RouteDef } from "@larp/shared";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { createApp } from "../src/app";
import { db } from "../src/lib/db";
import { prepEvent } from "../src/modules/prep/jobs";
import { parseGuestList } from "../src/modules/prep/sources";

let base = "";
const server = createApp().listen(0);
beforeAll(() => {
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => void server.close());

const user = () => `test-contacts-${crypto.randomUUID()}`;

async function call<D extends RouteDef>(u: string, def: D, opts: { params?: Record<string, string>; body?: unknown } = {}): Promise<ResOf<D>> {
  const res = await fetch(base + buildPath(def.path, opts.params), {
    method: def.method,
    headers: { "content-type": "application/json", [USER_HEADER]: u },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  expect(res.status, `${def.method} ${def.path}`).toBe(200);
  return def.res.parse(await res.json()) as ResOf<D>;
}

const waitFor = async <T>(fn: () => Promise<T>, ok: (v: T) => boolean) => {
  for (let i = 0; i < 100; i++) {
    const v = await fn();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("timed out");
};

async function prepped(u: string, guestList: string) {
  const e = await call(u, api.createEvent, { body: { guestList } });
  return waitFor(() => call(u, api.getEvent, { params: { id: e.id } }), (x) => x.status !== "pending");
}

test("same person at two events is one contact with both events", async () => {
  const u = user();
  const a = await prepped(u, "Sam Chen - Founder, VoiceKit https://www.linkedin.com/in/Sam-Chen/\nAda Lovelace");
  const b = await prepped(u, "sam  chen\nGrace Hopper");
  expect(a.name).toMatch(/^Mystery mixer/);

  const rows = await call(u, api.listContacts);
  expect(rows.map((r) => r.name).sort()).toEqual(["Ada Lovelace", "Grace Hopper", "Sam Chen"]);
  const sam = rows.find((r) => r.name === "Sam Chen")!;
  expect(sam.eventIds.sort()).toEqual([a.id, b.id].sort());
  expect(sam.personIds).toHaveLength(2);

  const t = await call(u, api.getContact, { params: { id: sam.id } });
  expect(t.events.map((e) => e.id)).toEqual([a.id, b.id]);
  expect(t.people.every((p) => p.contactId === sam.id)).toBe(true);
  // The bare "sam chen" at event B inherits what event A told us.
  const samAtB = (await call(u, api.listPeople, { params: { id: b.id } })).find((p) => p.contactId === sam.id);
  expect(samAtB?.headline).toBe("Founder, VoiceKit");
});

test("different LinkedIns with the same name stay two contacts", async () => {
  const u = user();
  await prepped(u, "Alex Kim linkedin.com/in/alex-kim-1");
  await prepped(u, "Alex Kim linkedin.com/in/alex-kim-2");
  expect((await call(u, api.listContacts)).filter((r) => r.name === "Alex Kim")).toHaveLength(2);
});

test("re-prepping an event keeps people's ids and dossiers", async () => {
  const u = user();
  const e = await prepped(u, "Ada Lovelace\nAlan Turing");
  const [ada] = (await call(u, api.listPeople, { params: { id: e.id } })).filter((p) => p.name === "Ada Lovelace");
  await call(u, api.requestDossier, { params: { id: ada.id } });
  await waitFor(() => call(u, api.getPerson, { params: { id: ada.id } }), (p) => p.dossierStatus === "ready");

  await prepEvent({ userId: u, eventId: e.id, guestList: "ada lovelace - Analyst\nGrace Hopper" });
  const people = await call(u, api.listPeople, { params: { id: e.id } });
  expect(people.map((p) => p.name).sort()).toEqual(["Ada Lovelace", "Alan Turing", "Grace Hopper"]);
  const again = people.find((p) => p.id === ada.id)!;
  expect(again.dossierStatus).toBe("ready");
  expect(again.headline).toBe("Analyst");
  expect((await call(u, api.listContacts)).filter((r) => r.name === "Ada Lovelace")).toHaveLength(1);
});

test("timeline matches conversations by person, contact, or just a name; strangers become contacts", async () => {
  const u = user();
  const e = await prepped(u, "Sam Chen\nPriya Patel");
  const [sam] = (await call(u, api.listPeople, { params: { id: e.id } })).filter((p) => p.name === "Sam Chen");
  const convo = { transcript: [], hints: [], linksShared: [] };
  await db.conversations.put(u, { ...convo, id: "c1", personId: sam.id, startedAt: 1, endedAt: 2 });
  await db.conversations.put(u, { ...convo, id: "c2", participants: [{ name: "SAM CHEN" }, { name: "Mo Salah" }], startedAt: 3 });
  await db.followUps.put(u, { id: "f1", conversationId: "c2", personName: "Sam Chen", summary: "", promises: ["deck"], draft: "", dueAt: 0, status: "open" });

  const rows = await call(u, api.listContacts);
  const samRow = rows.find((r) => r.name === "Sam Chen")!;
  expect(samRow.status).toBe("followup");
  expect(rows.find((r) => r.name === "Priya Patel")?.status).toBe("listed");
  expect(rows.find((r) => r.name === "Mo Salah")?.status).toBe("talked");
  expect(rows[0].name).not.toBe("Priya Patel"); // recent interaction first

  const t = await call(u, api.getContact, { params: { id: samRow.id } });
  expect(t.conversations.map((c) => c.id)).toEqual(["c2", "c1"]);
  expect(t.followUps.map((f) => f.id)).toEqual(["f1"]);
});

test("quick-add someone off the list at an event", async () => {
  const u = user();
  const e = await prepped(u, "Ada Lovelace");
  const c = await call(u, api.createContact, { body: { name: "Mo Salah", link: "x.com/mo", note: "met at the snack table", eventId: e.id } });
  expect(c.eventIds).toEqual([e.id]);
  expect((await call(u, api.listPeople, { params: { id: e.id } })).map((p) => p.name)).toContain("Mo Salah");
  // Adding the same human again merges.
  const again = await call(u, api.createContact, { body: { name: "mo salah", note: "likes F1" } });
  expect(again.id).toBe(c.id);
  expect(again.note).toBe("met at the snack table\nlikes F1");
});

test("events list oldest -> newest; delete removes people and contact links", async () => {
  const u = user();
  const a = await prepped(u, "Ada Lovelace");
  const b = await prepped(u, "Ada Lovelace\nAlan Turing");
  // Updating the older one must not reorder it (Postgres lists by last update).
  await call(u, api.updateEvent, { params: { id: a.id }, body: { name: "Renamed" } });
  expect((await call(u, api.listEvents)).map((e) => e.id)).toEqual([a.id, b.id]);

  await call(u, api.deleteEvent, { params: { id: b.id } });
  expect((await call(u, api.listEvents)).map((e) => e.id)).toEqual([a.id]);
  const rows = await call(u, api.listContacts);
  expect(rows.map((r) => r.name)).toEqual(["Ada Lovelace"]);
  expect(rows[0].eventIds).toEqual([a.id]);
});

test("unreadable event link is an error with a fix, and is not cached", async () => {
  const u = user();
  const url = `https://lu.ma/missing-${crypto.randomUUID()}`;
  const realFetch = globalThis.fetch;
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) =>
    String(input).startsWith(url)
      ? Promise.resolve(new Response("<html><title>Page Not Found · Luma</title></html>", { status: 200 }))
      : realFetch(input, init),
  );
  try {
    await db.events.put(u, { id: "bad", name: url, url, status: "pending" });
    await prepEvent({ userId: u, eventId: "bad" });
    const e = await db.events.require(u, "bad");
    expect(e.status).toBe("error");
    expect(e.error).toMatch(/paste the guest list/i);
    const file = new URL(`../.cache/prep/event-${createHash("sha1").update(JSON.stringify(url)).digest("hex").slice(0, 16)}.json`, import.meta.url);
    expect(existsSync(file)).toBe(false);

    // Same bad link plus pasted names still preps from the names, in place.
    await call(u, api.addGuests, { params: { id: "bad" }, body: { guestList: "Ada Lovelace" } });
    await waitFor(() => call(u, api.getEvent, { params: { id: "bad" } }), (x) => x.status === "ready");
    expect((await call(u, api.listPeople, { params: { id: "bad" } })).map((p) => p.name)).toEqual(["Ada Lovelace"]);
  } finally {
    spy.mockRestore();
  }
});

test("links in pasted lists are pulled out and made absolute", () => {
  expect(parseGuestList("Sam Chen - Founder, linkedin.com/in/sam")).toEqual([
    { name: "Sam Chen", headline: "Founder", links: ["https://linkedin.com/in/sam"] },
  ]);
});
