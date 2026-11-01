THEME: Create a product to help you LARP as someone you are not

# Role Swap (working name)

> Larp as the person you're scared to talk to. Hear your own words in your own voice. Then go do it for real.

Rehearse a hard conversation by playing the **other** person while an AI plays **you**, speaking in your own cloned voice. Then switch back and practise as yourself against an AI version of them, and get feedback you can measure.

---

## 1. Context

### Hackathon: LarpHacks (Toronto, Nov 2026, GDG DevFest at UofT)
- Run by high-school organizers. It started as a joke, and 400+ students applied.
- The vibe is Gen Z memes. **"Larp" = slang for faking or posing as someone you're not.**
- The event encourages being open about using AI.

### Rubric (30 pts, 6 × 5)
Working Product · Usefulness · Theme Alignment · Creativity · Ease of Use · Demo

### Sponsor tracks
- **ElevenLabs:** voice must be part of the core feature. Prize: Scale plan for each team member.
- **Render:** deploy live and explain Render's role.

### Judges
| Judge | Background | What they value |
|---|---|---|
| Artin Mehri | Co-lead for growth and partnerships. Built Sportiner (tennis-partner app, 250+ users, App Store) | Real users, whether people come back, talking to users |
| Slava Kostrubin | Co-founder and tech lead, Grade 12, 4 hackathon wins (Most Impactful: food bank finder; Cursor runner-up: Telegram invoice agent) | Things that work end to end, concrete impact. Negotiated the ElevenLabs and Render sponsorships. Writes in memes |

---

## 2. How we got here

Rejected ideas and why:
- **Interview, pitch or rizz coach:** every team asking AI for ideas will build this.
- **Real-time "expert" earpiece:** listening to two voices at once doesn't work, and lag of 1–3 seconds makes the hint arrive too late.
- **Native-speaker voice translation:** latency risk in a live demo.
- **Persona generator:** too niche.

The key change: most ideas are "you play yourself, but better." **We flip that: you play *them*.** This builds on role reversal from psychodrama, where hearing your own words said to you shows how they land.

Concern raised: "isn't it just an LLM wrapper?" The answer is to add parts the LLM can't do alone (voice cloning, numbers from your speech, a two-mode loop), not complexity for its own sake. The rubric does not score technical difficulty.

---

## 3. Simulated judging (predicted, persona-based)

| Judge | Score | Gut reaction |
|---|---|---|
| Artin | about 24/30 | "Lowkey creepy in a good way. Is the 50-agent chart actually needed?" |
| Slava | about 22–24/30 | "kinda unhinged lol. voice part is tuff. 50 agents thing feels like a slide." |
| ElevenLabs judge | Strong top-2 for the track | "Finally, not a chatbot reading its answer aloud." |
| Crowd and competition | 25–35% chance of top 3 · 35–45% chance of winning ElevenLabs | Only entry with real usefulness. Could read as a "therapy app with a theme sticker." |

**What all 4 agreed on:**
- ✅ Hearing your own cloned voice say the line to you is the winning moment (Demo 5/5 if voice leads).
- ❌ The "38/50 escalated" stress-test chart looks like padding or an invented stat.
- ❌ A therapy tone and old scenarios (quitting med school) clash with the meme crowd.
- ❌ Usefulness stays at 3 unless we show real people using it.

**Likely competing projects:** fake founder/LinkedIn generator, rizz coach, fake-rich content, "sound smart" earpiece, voice-clone prank caller (expect 3+ teams), voice changer.

**Hardest Q&A questions to prepare for:**
1. "Who actually tried it?" (Artin)
2. "Are your numbers real, or one LLM grading another?" (Slava)
3. "What stops someone from cloning another person's voice?" (both)
4. "Why play dad instead of just practising as myself?" Answer: you feel how your own words land.

---

## 4. Features

### Must have (about 12 hours)

**1. Brain dump that also creates the voice clone (no script)**
- The user talks for 60 seconds about what they want to say.
- The same recording becomes the ElevenLabs instant voice clone sample **and** the content: an LLM pulls out key points and phrasing.
- 3 quick taps describe the other person:
  - **Who:** Dad / Mom / Friend / Teacher / Partner
  - **Temperament:** Stubborn / Emotional / Dismissive / Chill
  - **Optional:** one line of context ("he paid my tuition")
- Why: typing a script adds friction, and people plan the points they want to make, not exact lines.

**2. Role Swap (you play them)**
- Live voice session. The user plays dad.
- The AI plays the user, improvising from their key points **in the user's cloned voice**.

**3. Forward mode (you play yourself)**
- The user plays themselves. The AI plays dad with a **Voice Design** voice ("tired, disappointed, 50s").
- This shows a second ElevenLabs feature and makes the product a loop instead of a one-time trick.

**4. Feedback (numbers you can measure, no claims about detecting emotions)**
- **Pace:** words per minute from the speech-to-text word timestamps
- **Filler words:** "um," "like," "I mean"
- **Pauses and interruptions:** how often you cut dad off
- **Key points made:** did you say what you planned, or back down? (LLM checks against the brain dump)
- **Before and after:** compare runs, and suggest a rewrite of your weakest line

**5. Consent, privacy and deployment**
- Consent sentence read aloud on screen. That recording is the clone sample.
- The voice is deleted through the API when the session ends.
- Deployed on Render.

### Nice to have (only if ahead of schedule)
- **Camera:** MediaPipe in the browser (face plus pose; no upload, which is a privacy win). Track 2 metrics only: eye contact % and looking away or crossing arms during tense moments. About 3–4 hours.
- **Stress test:** run the opening line against several variants of the other person. Show it as a **wall of transcripts you can click into**, not a percentage chart. About 3 hours.

### Out of scope
- Detecting emotion from audio (unreliable in a noisy room)
- Accounts and saved history

---

## 5. User flow
1. Consent, then a 60-second brain dump (creates the voice clone and extracts key points)
2. Pick who and their temperament
3. **Role Swap:** you play them, and "you" talk in your own voice (2–3 turns)
4. **Forward mode:** you play yourself against the AI version of them (2–3 turns)
5. Feedback screen, then retry

Target: the first time a user hears their cloned voice is **within 60 seconds** of starting.

---

## 6. Proposed tech stack (not final)
| Need | Tool |
|---|---|
| Frontend | React / Next.js |
| Voice clone | ElevenLabs Instant Voice Cloning API |
| Voice for the other person | ElevenLabs Voice Design |
| Live conversation | ElevenLabs Agents (Conversational AI) with a custom voice |
| Transcription and timestamps | ElevenLabs Scribe |
| Extraction and feedback | Claude |
| Hosting | Render |
| Camera (stretch) | MediaPipe Face Landmarker and Pose |

---

## 7. Demo script (2 minutes)
1. **0:00 Hook (15s).** "Everyone's got a conversation they're avoiding. We built a way to larp as the person you're scared of."
2. **0:15 Funny scenario (45s).** A teammate reads the consent line, does a brain dump ("telling my parents about my report card"), and picks Dad + Stubborn. The teammate plays dad, and their **own cloned voice** answers. This is the gasp moment.
3. **1:00 Forward mode (25s).** Switch: the teammate plays themselves against the Voice Design dad.
4. **1:25 Feedback (20s).** Pace, filler words, key points made, one suggested rewrite.
5. **1:45 Proof and close (15s).** A slide showing that N hackers tried it, their before and after lines, and one quote. Delete the voice live. Mention Render and ElevenLabs.

**Scenarios for this crowd:** report card, asking someone to formal, calling out a group-project partner who did nothing, skipping the friend trip. Open with a funny one, then show one real one briefly.

**Pitch lines:**
- "Larp as your dad for 5 minutes so you know exactly how he'll fold when you tell him."
- "The only larp with ROI: become the person you're scared of, beat them, then go do it for real."

---

## 8. Risks
| Risk | Mitigation |
|---|---|
| Live voice lag of 2–4 seconds kills the magic | Keep 2–3 turns, test on venue wifi, have a **pre-recorded fallback video** |
| Comes across as a therapy app at a meme event | Funny scenario first, real one second. Never say "psychodrama" on stage |
| "Who used it?" | Have 8–10 hackers try it during the event and put the results on a slide |
| Concerns about voice-clone misuse | Consent recording is the sample, voice deleted live, clone only usable in your own session |
| Scope creep (camera, stress test) | Start these only after must-haves 1–5 work end to end |

---

## 9. Build plan (about 12 hours of core work)
| Block | Work | Done when |
|---|---|---|
| 0–1h | Scaffold, deploy to Render, ElevenLabs keys | Hello-world is live on Render |
| 1–3h | Brain dump → voice clone + key-point extraction | Clone plays back the user's voice |
| 3–6h | Role Swap agent in the cloned voice | 3-turn live conversation works |
| 6–8h | Forward mode with a Voice Design voice | The other person sounds distinct |
| 8–10h | Feedback screen (pace, fillers, key points) | Real numbers from a real run |
| 10–11h | Consent step, voice deletion, polish | Full flow in under 3 minutes |
| 11–12h | User testing with hackers, record fallback video | Proof slide plus backup video ready |
| Extra time | Camera → stress test | — |
