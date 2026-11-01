# How the chunks fit together

Read this before starting your chunk. It covers what you own, what you share, and the rules that let us build separately and still have everything snap together at the end.

The short version: **build inside your folder, talk to other chunks only through the contracts in `shared/`, keep the stubs working.**

## The map

```
 Phone (web/, Render Static Site)                       Render Web Service (server/)
┌──────────────────────────────┐   REST /api/*      ┌─────────────────────────────────────┐
│ People · Person · Me ·       │ ─────────────────▶ │ modules/profile  modules/prep       │
│ Follow-ups  (features/*)     │                    │ modules/followups                   │
│                              │   WebSocket /live  │                                     │
│ Live mode ──── mic audio ──────────────────────▶ │ modules/live/session ── STT          │
│   hint text + whisper audio ◀─────────────────── │   └─ LiveListeners: hints,           │
│   link cards               ◀─────────────────── │      linkcards, followups            │
└──────────────────────────────┘                    └──────────┬──────────────┬───────────┘
                                                               │ enqueue      │ read/write
                                         Render Key Value ◀────┘              ▼
                                                  │                    Render Postgres
                                                  ▼                           ▲
                                     Render Background Worker ───────────────┤
                                     (profile.build, prep.*)                  │
                                     Render Cron Job (nudges) ────────────────┘
```

## What you own

| Chunk | Server | Web | Plugs in via |
|---|---|---|---|
| 1 Earpiece | `server/src/modules/live/*` | `web/src/features/live/*` | owns the session; `hintsListener` |
| 2 Link cards | `server/src/modules/linkcards/*` | `web/src/features/linkcards/*` | `linkCardsListener` (partials) |
| 3 Knowledge base | `server/src/modules/profile/*` | `web/src/features/profile/*` | `profile.build` job, `Profile` doc |
| 4 Prep | `server/src/modules/prep/*` | `web/src/features/prep/*` | `prep.*` jobs, `Event`/`Person` docs |
| 5 Follow-ups | `server/src/modules/followups/*`, `cron-nudge.ts` | `web/src/features/followups/*` | `followUpsListener` (onEnd), cron |
| 6 App shell | — | `App.tsx`, `routes.ts`, `components/*`, `index.css`, `features/setup/*`, PWA config | the look + navigation |
| 7 Demo | `scripts/live-sim.ts`, fixtures | — | — |

Change anything inside your folders however you like: libraries, structure, prompts, providers.

## Shared files (one-line additions only)

These files glue chunks together. Add your line; don't restructure them without telling the team.

| File | You add |
|---|---|
| `shared/src/*.ts` | fields, routes, messages (see contract rules) |
| `server/src/listeners.ts` | your `LiveListener` |
| `server/src/jobs.ts` | your background job |
| `server/src/app.ts` | your router |
| `server/src/lib/db.ts` | a new collection |
| `server/src/lib/llm.ts` | owned by whoever wires the LLM provider; everyone calls `askJson` / `streamText` |
| `web/src/App.tsx`, `web/src/routes.ts` | your screen + its path |

## Screen flow

The event hub (`/events/:id/:stage`, `web/src/features/event/`) is the spine: **Prep** (ranked guest list) → **Live** (who's met, chats tonight) → **Recap** (that event's follow-ups). Live mode is opened from an event (`paths.live({ eventId, personId })`), shows the event, and End returns to the hub. Tabs are Events · People · Me; `/` redirects to today's (else newest) event. Link to an event's stage with `paths.event(id, stage)`; new screens reuse `Row`, `Pill`, `Menu` and the four `text-*` sizes in `components/ui.tsx` / `index.css`.

## The five seams

Every connection between chunks goes through one of these. If you need a connection none of them covers, raise it with the team before building it.

1. **Data models** (`shared/src/models.ts`): `Profile`, `Event`, `Person` + `Dossier`, `Conversation`, `FollowUp`. Zod schemas, validated on every read and write.
2. **REST routes** (`shared/src/api.ts`): web calls `call(api.x, …)`, server implements `handle(router, api.x, …)`. Both sides are type-checked against the same definition.
3. **Live protocol** (`shared/src/live.ts`): JSON control messages plus binary audio frames on one WebSocket.
4. **LiveListener** (`server/src/modules/live/session.ts`): hook into a conversation with `onPartial` (fast, sync), `onUtterance`, `onEnd`. The listener gets `ctx` with profile, person, transcript, `whisper()`, and `shareLink()`.
5. **Jobs** (`server/src/jobs.ts`): `enqueue("prep.dossier", …)`. Runs on the Render worker in prod and inline locally.

## Contract rules

- **Additive only.** New fields are `.optional()` or have a `.default()`. Never rename or remove a field someone else reads; add the new one, migrate, and delete it later together.
- **Contract changes go in their own small commit**, pushed early, with a heads-up in the team chat.
- **Status fields, not callbacks.** Slow things set `status: "pending"` and later `"ready"`/`"error"`. The web polls with `useApi(..., pollWhile)`. No custom push channels.
- **Fixtures follow the schema.** If you add a field that matters to the demo, add it to `shared/src/fixtures.ts`.

## Keep stubs working

Every chunk starts as a working stub, so the whole app runs end to end from the first commit. When you replace a stub:

- Keep the same function signature and contract.
- Degrade gracefully when keys are missing (no ElevenLabs key: hints show on screen but are silent; no LLM: fall back to the stub). A teammate without your API key must still be able to run the app.
- Never let your listener throw into the session. The session already isolates failures, but don't rely on that.

## Speed rules (live path)

The earpiece is the demo, and latency is the product.

- `onPartial` must not do network calls or `await`. It runs many times a second.
- Do slow thinking in prep (dossiers, likely Q&A) so the live path only picks and shortens.
- Whisper the first sentence as soon as it streams. Keep hints to about 8 words.
- Measure: `npm run sim` prints timestamps for every message.

## Workflow

```bash
npm install
npm run dev                 # api :3000 + web :5173 (open on your phone via your LAN IP)
npm run sim                 # scripted conversation against the running server
npm test                    # server contract + live pipeline tests
npm run typecheck           # all packages
node scripts/ui-smoke.mjs   # clicks through the app on a phone-sized screen (needs npm run dev)
```

- Branch per chunk: `chunk/1-earpiece`, `chunk/4-prep`, …
- Merge to `main` small and often (at least every few hours). `main` auto-deploys to Render, so it must stay green.
- Before merging: `npm test && npm run typecheck`, plus `node scripts/ui-smoke.mjs` if you touched web.
- `scripts/test-prod-stack.sh` runs the tests against real Postgres + Key Value + the worker in Docker.

## Local vs Render

| | Local default | Render |
|---|---|---|
| Store | in-memory (resets on restart) | Postgres (`DATABASE_URL`) |
| Jobs | inline in the API process | Key Value + worker (`REDIS_URL`) |
| User | `x-user-id` per device, `?user=demo` to share | same |

Point local at Render's DB by putting its external URL in `.env` as `DATABASE_URL`.

## Secrets

Keys live in `.env` locally (gitignored) and in Render env vars in prod. Never in code, commits, screenshots, or chat. If one leaks, rotate it.
