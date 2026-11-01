# Larp

An earpiece coach that lets you larp as the most prepared person at any networking event.

- **Product:** [`docs/brainstorm.md`](docs/brainstorm.md)
- **Judging rubric:** [`docs/RUBRIC.md`](docs/RUBRIC.md)
- **Build plan + chunks:** [`docs/plan.md`](docs/plan.md)
- **How the chunks connect (read before coding):** [`docs/integration.md`](docs/integration.md)

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 and tap **"Just show me the demo"**. No keys or databases needed: everything falls back to stubs, an in-memory store, and inline jobs. Copy `.env.example` to `.env` to turn real services on.

```bash
npm run sim      # play a scripted conversation, see hints + link cards with timings
npm test         # contract + live pipeline tests
```

## Layout

```
shared/   contracts: data models, REST routes, live protocol, demo fixtures
server/   API + WebSocket, background worker, cron (one package, three entrypoints)
web/      phone web app (Vite + React + Tailwind)
scripts/  dev helpers
render.yaml  the full Render deployment
```
