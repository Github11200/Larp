# Build plan

General direction per chunk. Whoever picks up a chunk owns the details.
How the chunks connect (folders, contracts, rules): **`docs/integration.md`**. Every chunk already has a working stub, so start by replacing yours.

## Stack at a glance

- **Form factor:** mobile web app (installable) on the phone + Bluetooth earbuds. Phone screen shows link cards; earbuds get the whispers.
- **Language:** TypeScript everywhere.
- **Hosting:** Render, defined in one `render.yaml` Blueprint.
- **Voice:** ElevenLabs Scribe realtime (listening) + Flash TTS (whispering).
- **Brains:** LLM provider TBD (kept swappable in `server/src/lib/llm.ts`). Fast model for live hints, stronger model for prep and dossiers.

| Render piece | Used for |
|---|---|
| Static Site | The web app |
| Web Service | Live conversation (WebSocket) + API |
| Background Worker | Event + people prep |
| Key Value | Job queue for prep |
| Postgres | Everything we store |
| Cron Job | Follow-up nudges |

## Guiding principles

- **Speed is the product.** Do slow thinking before the event, keep the live path short.
- **One-tap simple.** Paste your links, paste the event, press Start.
- **Funny first, useful second.** Meme-y tone in copy, voice, and demo.
- **Deployed early.** Everything runs on Render from day one, not just at the end.

## Order

1. Chunk 0 is done locally; remaining step is the first Render deploy.
2. Chunks 1, 3, 4, 6 in parallel.
3. Chunk 2 once chunk 1 has a live transcript.
4. Chunk 5 once conversations are being saved.
5. Chunk 7 runs alongside from the start.

---

## Chunk 0 · Foundations ✅ (except first deploy)

Get a skeleton deployed to Render so everyone builds on a live URL.

- Repo layout for the web app, server, and worker
- `render.yaml` with all services, deployed
- Agree on the shared shapes: **profile**, **event**, **person/dossier**, **conversation**, **promise**
- Secrets live in Render env vars only, never in the repo

**Done when:** a "hello" page and a WebSocket ping work on the live Render URL.

## Chunk 1 · Earpiece coach (the core demo)

Listen to the conversation and whisper a short hint when it helps.

- Phone mic streams to the server over one WebSocket
- ElevenLabs Scribe realtime turns speech into text
- When the other person asks something or the chat stalls, Claude writes a very short hint (a few words) using your profile and their dossier
- ElevenLabs Flash TTS speaks it, streamed back to the earbud
- Pick or design a whispery "coach" voice

**Lives in:** `server/src/modules/live`, `web/src/features/live`. Replace `stt.ts`, `tts.ts`, `hints.ts`, and mic/audio in `useLive.ts`.

**Done when:** you ask a question out loud and a useful hint plays in the earbud fast enough to feel natural. Measure the delay.

## Chunk 2 · Live link cards

When someone asks for your demo, LinkedIn, GitHub, etc., the right link pops up on screen as a scannable card.

- Watch the live (partial) transcript for link requests. No LLM needed, keep it instant.
- Links come from the profile (chunk 3)
- Big QR code + link, readable by someone standing across from you

**Lives in:** `server/src/modules/linkcards`, `web/src/features/linkcards`.

**Done when:** saying "do you have a demo?" shows the card almost immediately.

## Chunk 3 · Knowledge base (you)

Turn your resume and links into a profile every other feature uses.

- Input: resume upload + a handful of links
- Claude extracts who you are, what you've built, what you're good at, and your shareable links
- Editable profile screen so the user can fix mistakes

**Lives in:** `server/src/modules/profile`, `web/src/features/profile`. Replace `build.ts`.

**Done when:** a real teammate's profile is built from their actual links.

## Chunk 4 · Event + people prep (them)

Find out who's at the event, rank who's worth meeting, and build dossiers.

- Input: an event link (e.g. Luma) or a pasted guest list
- Runs as a background job on the Render worker, with progress shown in the app
- Rank attendees against the profile, with a one-line "why talk to them"
- For picked people: dossier with what they work on, interests, common ground, and a few openers
- The live coach (chunk 1) uses these dossiers

**Lives in:** `server/src/modules/prep`, `web/src/features/prep`. Replace `jobs.ts`.

**Done when:** pasting a real event link produces a ranked list and good dossiers for a few people.

## Chunk 5 · Follow-up tracker

After the event: who you met, what you talked about, what you promised.

- Each conversation becomes a summary + list of promises
- Render Cron Job sends nudges later; it can also be triggered manually for the demo
- Drafted follow-up message ready to send

**Lives in:** `server/src/modules/followups`, `web/src/features/followups`.

**Done when:** after a demo conversation, the tracker shows the person, the promise, and a drafted message.

## Chunk 6 · App shell + design

The screens that tie everything together, built for a phone.

- Screens: setup (profile + event), people list, dossier, **live mode**, follow-ups
- Live mode: one big Start button, tap who you're talking to, link cards take over the screen
- Meme-y personality in copy and visuals, but dead simple to use

**Lives in:** `web/src/App.tsx`, `routes.ts`, `components/`, `index.css` (design tokens).

**Done when:** a first-time user can go from opening the URL to live mode without help.

## Chunk 7 · Demo + pitch

Win the room, the Render track, and the ElevenLabs track.

- Live skit: one person networks, another plays the stranger; phone mirrored on the projector, whispers played through the speakers
- Show the link card moment and a follow-up nudge
- One slide on Render: the Blueprint and the services in the dashboard, and what each one does
- One slide on ElevenLabs: listening + whispering are the core of the product
- Get a few real people to try it before judging and mention it
- Have a backup recording in case wifi fails

**Lives in:** `scripts/live-sim.ts` (scripted conversation), `shared/src/fixtures.ts` (demo people).

**Done when:** the full demo has been rehearsed end to end at least twice on the live deployment.
