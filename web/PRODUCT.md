# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (installable mobile web app, phone-first; Bluetooth earbuds carry the audio)

## Stack

React 19 + Vite + Tailwind v4 + react-router 7, TypeScript. Deployed as a Render Static Site. Design tokens live in `web/src/index.css`.

## Users and job

Someone walking into a networking event (hackathon, meetup, mixer) who wants to come across as the most prepared, most charismatic person in the room without doing the homework. They use it in three moments:

1. **Before** (at home or on the way, a few minutes): tell it who you are (links, resume), paste the event (Luma link or guest list), skim who's worth meeting and their dossiers.
2. **During** (standing in a loud room, phone in hand or pocket, earbud in): it listens, whispers short hints, and pops your link as a scannable card when someone asks for it. You turn the phone around to show the card.
3. **After** (days later): see who you met, what you promised, send the drafted follow-up.

Secondary audience: hackathon judges trying it cold, and a room watching the phone mirrored on a projector during a live skit.

## Positioning

The theme is "help you LARP as someone you are not." This is the networking larp: a coach in your ear that knows you and knows them. Funny first, useful second. The earpiece (ElevenLabs listening + whispering) is the core demo.

## Confirmed flow decisions (2026-11-01)

- **First run:** guided three-step setup (You → Event → Pick people → Go live). Profile and prep build in the background while the user keeps moving. A visible "use the demo crowd" exit seeds fixtures so a judge reaches live mode in seconds. After setup, home is the tabbed app.
- **Live screen:** glanceable for the wearer. Latest hint is the largest thing on screen, a chip shows who you're talking to, transcript is small and secondary. A link card takes over the full screen, readable by the person across from you. Must also read well mirrored on a projector.
- **Who you're talking to:** both entry points. "Talk to <name>" from a dossier, or one big Start with nobody picked. Live mode has a strip of top people to tap or switch mid-conversation.
- **Ownership:** chunk 6 owns the markup of every screen; feature chunks own hooks, API calls, and logic.

## Constraints

- One-hackathon demo: speed over robustness, pre-baked demo data is fine.
- App must run with no API keys, DB, or Redis (stubs). Slow things show `pending` states and poll.
- Live path must feel instant; nothing in the UI should block on network during a conversation.

## Voice

Meme-y, Gen Z hackathon humour (judges are high-school organizers who started LarpHacks as a joke). Copy is playful but every label still says plainly what happens. Earnest or therapy-style tone clashes with the room.

## Open decisions

- Visual world: to be chosen in the direction round.
