THEME: Create a product to help you LARP as someone you are not

# Idea: networking earpiece coach

Larp as a smooth networker: prep on the people at an event, get whispered hints mid-conversation, never forget a follow-up.

## Scope

| # | Piece | Verdict | Est. |
|---|---|---|---|
| 1 | Earpiece coach | Must, real. The demo. | ~5–6h |
| 2 | People dossier + openers | Must, narrow: paste names/links → dossier + 3 openers. Feeds earpiece context. | ~3h |
| 3 | Knowledge base | Thin: resume upload + a few links. No email sync. | ~1h |
| 1b | Live link cards | Must. Same transcript stream: they ask for your demo/GitHub/LinkedIn → card with link + QR is already on screen. | ~1.5h |
| 4 | Follow-up tracker | Nice: transcript → action items + drafted follow-up. | ~1.5h |

Cut: calendar scanning (type the event instead), acting on your behalf.

## Earpiece pipeline

Mic → ElevenLabs Scribe realtime STT → question/pause trigger → Claude Haiku (your profile + their dossier) → ElevenLabs Flash TTS → AirPods.

- Latency budget: <2s end to end.
- Hints ≤8 words so they don't drown out the other person.
- Tap-to-ask fallback trigger.
- Link cards: knowledge base stores links as `{label, url, description}`; Haiku matches the request to one link; phone shows one card at a time (newest replaces older) with link + QR. Visual backup if audio fails on stage.

## Demo hook

Run prep on the judges live ("we ran our app on you"). A judge asks a tricky question; earpiece whispers; presenter answers.

## Risks

1. Instagram scraping: blocked by Meta and reads creepy on stage. Use public professional sources (LinkedIn, Devpost, GitHub, personal sites). "Stalking" stays a branding joke.
2. Recording consent: Ontario is one-party consent, so recording your own conversations is legal. Have this answer ready.
3. Latency/overlap: build the earpiece first.
