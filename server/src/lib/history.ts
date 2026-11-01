// Demo "time skip": a few weeks of past events, people, conversations, and follow-ups, so the People tab
// can show what Larp looks like after real use. Static and idempotent (fixed ids, dates relative to now).
import type { Contact, Conversation, Event, FollowUp, Person, Utterance } from "@larp/shared";
import { db } from "./db";

const DAY = 86_400_000;
const ago = (days: number, hour = 19) => {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

const EVENTS = {
  htn: { name: "Hack the North 2026", daysAgo: 49 },
  velocity: { name: "Velocity Demo Day", daysAgo: 30 },
  ttw: { name: "Toronto Tech Week: AI Founders Mixer", daysAgo: 13 },
} as const;
type EventKey = keyof typeof EVENTS;

interface Meeting {
  at: EventKey;
  /** Alternating them/me, starting with them. */
  lines: string[];
  hints: string[];
  summary: string;
  learned: string[];
  moments: string[];
  /** Other people in a group chat. */
  with?: string[];
  followUp?: {
    promises: string[];
    theirPromises?: string[];
    draft: string;
    status: FollowUp["status"];
    /** Negative = overdue. */
    dueInDays: number;
  };
}

interface HistoryContact {
  key: string;
  name: string;
  headline: string;
  links: string[];
  why: string;
  dossier: Person["dossier"];
  meetings: Meeting[];
}

const PEOPLE: HistoryContact[] = [
  {
    key: "maya",
    name: "Maya Chen",
    headline: "Partner @ Northgate Ventures · pre-seed",
    links: ["https://linkedin.com/in/maya-chen-demo"],
    why: "Writes first cheques into student founders",
    dossier: {
      summary: "Pre-seed investor who backs Waterloo founders before they have revenue. Loves health-tech.",
      workingOn: ["Raising Fund II", "Scouting student founders"],
      interests: ["Health-tech", "Voice AI", "Trail running"],
      commonGround: ["Health-tech", "Waterloo founders"],
      openers: ["What made you bet on student founders?", "What's the last health-tech pitch that surprised you?"],
    },
    meetings: [
      {
        at: "htn",
        lines: [
          "So what are you hacking on this weekend?",
          "An earpiece that whispers what to say at networking events. Very on brand for this room.",
          "Ha, I need that. Is it actually live, like real-time?",
          "Sub-second. It listens, ranks who's here, and feeds me lines.",
          "Okay, send me a demo video when it works. I mean it.",
        ],
        hints: ["Mention Ophi's healthcare angle; Northgate backs health-tech"],
        summary: "Met at the HTN sponsor booth. Maya wants a demo video of Larp once it's working.",
        learned: ["Partner at Northgate, writes $250k pre-seed cheques", "Ran the Waterloo marathon last year"],
        moments: ["Laughed at the earpiece pitch, asked for a demo video"],
        followUp: {
          promises: ["Send a demo video of Larp"],
          draft: "Hey Maya! Great meeting you at HTN. Here's the Larp demo I promised: [link]. Would love your take.",
          status: "done",
          dueInDays: -46,
        },
      },
      {
        at: "velocity",
        lines: [
          "You're the earpiece person! I watched the video, it's wild.",
          "Thank you! We've been using it at every event since.",
          "What's the plan, is this a company?",
          "Honestly Ophi is the company. Larp is the fun side quest.",
          "Then send me the Ophi deck. Let's grab coffee in November.",
        ],
        hints: ["They watched the video; ask what they'd want to see next", "Pivot to Ophi: health-tech is their thesis"],
        summary: "Second time meeting. Maya remembered the demo and asked for the Ophi deck plus a coffee in November.",
        learned: ["Remembered the Larp demo video", "Wants to see the Ophi deck", "Free for coffee in November"],
        moments: ["Called me 'the earpiece person' across the room"],
        followUp: {
          promises: ["Send the Ophi pitch deck", "Book coffee in November"],
          theirPromises: ["Intro to their health-tech portfolio founders"],
          draft: "Hi Maya, loved catching up at Velocity. Ophi deck attached. Does Nov 12 or 14 work for coffee?",
          status: "open",
          dueInDays: -3,
        },
      },
    ],
  },
  {
    key: "arjun",
    name: "Arjun Mehta",
    headline: "Founder @ Relaybird (YC F25) · voice agents",
    links: ["https://linkedin.com/in/arjun-mehta-demo", "https://relaybird.ai"],
    why: "Ships voice agents; same stack as your earpiece",
    dossier: {
      summary: "Building voice agents for clinic front desks. Ex-Waterloo, dropped out after YC.",
      workingOn: ["Relaybird phone agents", "Hiring founding engineers"],
      interests: ["Latency hacks", "Speech models", "Bouldering"],
      commonGround: ["Voice AI", "Healthcare clinics", "Waterloo"],
      openers: ["How do you get latency under a second on a phone line?", "What did YC push you hardest on?"],
    },
    meetings: [
      {
        at: "htn",
        lines: [
          "Are you streaming speech-to-text or batching?",
          "Streaming partials, then a fast model for hints.",
          "Same as us. Which model do you use for the turn-taking?",
          "A tiny one on Cerebras. Anything bigger was too slow.",
          "Smart. I'll intro you to our ElevenLabs contact, they'd love this.",
        ],
        hints: ["Ask how Relaybird handles interruptions", "Mention you both target clinics"],
        summary: "Deep stack chat with Arjun about real-time voice. Both building for clinics; he offered an ElevenLabs intro.",
        learned: ["Relaybird does phone agents for clinic front desks", "Uses streaming STT and a small turn-taking model", "Hiring founding engineers"],
        moments: ["Nerded out on latency for 20 minutes"],
        followUp: {
          promises: ["Share the Cerebras latency numbers"],
          theirPromises: ["Intro to their ElevenLabs contact"],
          draft: "Arjun! Here are the latency numbers I mentioned: p50 380ms on Cerebras. Still keen on that ElevenLabs intro.",
          status: "done",
          dueInDays: -45,
        },
      },
    ],
  },
  {
    key: "sofia",
    name: "Sofia Alvarez",
    headline: "Engineering Manager @ Pinecrest Health",
    links: ["https://linkedin.com/in/sofia-alvarez-demo"],
    why: "Hiring winter co-ops for clinical AI",
    dossier: {
      summary: "Leads the clinical AI team at Pinecrest. Hiring Waterloo co-ops for winter.",
      workingOn: ["Clinical note summarization", "Winter co-op hiring"],
      interests: ["Health records", "Mentoring", "Salsa dancing"],
      commonGround: ["Health records", "Patient access to care"],
      openers: ["What's the hardest part of shipping AI into clinics?", "What makes a co-op stand out to you?"],
    },
    meetings: [
      {
        at: "velocity",
        lines: [
          "I saw your demo. You work on health records?",
          "Yeah, at Cortico. Patient access and records, lots of automation.",
          "We're hiring co-ops for clinical AI this winter. You should apply.",
          "I'd love that. What does the team work on?",
          "Note summarization for doctors. Send me your resume directly.",
        ],
        hints: ["Bring up Cortico's records automation", "Ask what the co-op team ships"],
        summary: "Sofia runs clinical AI at Pinecrest and asked for my resume for a winter co-op.",
        learned: ["Hiring winter co-ops for clinical AI", "Team works on note summarization", "Prefers resumes sent directly"],
        moments: ["Offered a referral on the spot"],
        followUp: {
          promises: ["Send resume for the winter co-op"],
          draft: "Hi Sofia, thanks for chatting at Velocity! Resume attached for the clinical AI co-op. Happy to share more on the Cortico work.",
          status: "open",
          dueInDays: -9,
        },
      },
    ],
  },
  {
    key: "leah",
    name: "Leah Kim",
    headline: "PhD @ Vector Institute · speech recognition",
    links: ["https://linkedin.com/in/leah-kim-demo"],
    why: "Researches speaker diarization; your hardest bug",
    dossier: {
      summary: "Speech researcher working on who-said-what in noisy rooms.",
      workingOn: ["Diarization in crowds", "Paper for ICASSP"],
      interests: ["Speech models", "Climbing", "Film photography"],
      commonGround: ["Noisy-room speech", "Real-time audio"],
      openers: ["How do you tell speakers apart in a loud room?", "What's your ICASSP paper about?"],
    },
    meetings: [
      {
        at: "ttw",
        lines: [
          "Wait, your earpiece knows which voice is you?",
          "Mostly by volume and pitch. It breaks when someone's loud.",
          "That's exactly my thesis. Try enrolling a voiceprint first.",
          "Would you be up to look at our approach?",
          "Sure, send me a recording and I'll send my paper draft.",
        ],
        hints: ["Ask about diarization in noisy rooms", "Offer real event recordings as test data"],
        summary: "Leah studies speaker diarization and suggested voiceprint enrollment. Swapping a recording for their paper draft.",
        learned: ["PhD at Vector working on diarization", "Suggested voiceprint enrollment", "Submitting to ICASSP"],
        moments: ["Pulled out a whiteboard marker mid-mixer"],
        followUp: {
          promises: ["Send a noisy event recording"],
          theirPromises: ["Send their ICASSP paper draft"],
          draft: "Hey Leah, great chat at the mixer! Here's a recording from a loud event. Excited to read your draft.",
          status: "open",
          dueInDays: 2,
        },
      },
    ],
  },
  {
    key: "hana",
    name: "Hana Sato",
    headline: "Product Designer @ Fieldnote",
    links: ["https://linkedin.com/in/hana-sato-demo", "https://hanasato.design"],
    why: "Designs calm mobile UIs; yours needs a pass",
    dossier: {
      summary: "Designer behind Fieldnote's mobile app. Loves quiet, glanceable interfaces.",
      workingOn: ["Fieldnote mobile redesign"],
      interests: ["Glanceable UI", "Type design", "Ceramics"],
      commonGround: ["Mobile-first UX", "Glanceable screens"],
      openers: ["What makes a screen glanceable?", "What's the redesign changing?"],
    },
    meetings: [
      {
        at: "velocity",
        lines: [
          "Your hint screen is cool but too busy for a glance.",
          "Fair. What would you cut?",
          "Everything but the one line. Make it huge.",
          "Would you do a quick crit if I send screens?",
          "Yes, ping me after Tech Week.",
        ],
        hints: ["Ask what they'd cut from the hint screen"],
        summary: "Hana critiqued the live hint screen: cut to one huge line. Offered a design crit after Tech Week.",
        learned: ["Designs Fieldnote's mobile app", "Thinks the hint screen should show one line only"],
        moments: ["Sketched a better hint screen on a napkin"],
        followUp: {
          promises: ["Send hint screen mockups"],
          draft: "Hana! Thanks for the napkin crit. Screens here: [link]. Cut it to one line like you said.",
          status: "done",
          dueInDays: -28,
        },
      },
      {
        at: "ttw",
        lines: [
          "You made the line huge! Way better.",
          "All your idea. Still up for a crit?",
          "Definitely. Thursday works.",
        ],
        hints: ["Thank them: the redesign was their napkin sketch"],
        summary: "Hana saw the redesign and booked a design crit for Thursday.",
        learned: ["Free Thursdays for a crit"],
        moments: ["Recognized their napkin sketch in the app"],
        followUp: {
          promises: ["Send Figma link before Thursday's crit"],
          draft: "Hana! Thursday crit is on. Figma here: [link]. Thanks again for the napkin sketch.",
          status: "done",
          dueInDays: -10,
        },
      },
    ],
  },
  {
    key: "marcus",
    name: "Marcus Lee",
    headline: "SWE intern @ Stripe · Waterloo SE",
    links: ["https://linkedin.com/in/marcus-lee-demo"],
    why: "Knows payments infra and the Waterloo hackathon crowd",
    dossier: {
      summary: "Waterloo SE student interning at Stripe. Hackathon regular.",
      workingOn: ["Payments infra internship"],
      interests: ["Hackathons", "Rust", "Basketball"],
      commonGround: ["Waterloo", "Hackathons"],
      openers: ["What's Stripe's intern project like?", "Best hackathon you've been to?"],
    },
    meetings: [
      {
        at: "htn",
        with: ["Ines Duarte"],
        lines: [
          "You two should team up for the next hackathon.",
          "We'd need a designer. Ines?",
          "I'm in if it's something weird.",
          "An earpiece that LARPs for you is pretty weird.",
          "Perfect. Group chat?",
        ],
        hints: ["Suggest teaming up for the next hackathon"],
        summary: "Group chat with Marcus and Ines at HTN closing. Agreed to team up for the next hackathon.",
        learned: ["Marcus interns at Stripe on payments infra", "Ines designs and wants weird projects"],
        moments: ["Started a group chat on the spot"],
        followUp: {
          promises: ["Start the hackathon group chat"],
          theirPromises: ["Find the next hackathon to enter"],
          draft: "Marcus, Ines: group chat is live. Next hackathon, the weird-project trio rides again.",
          status: "done",
          dueInDays: -47,
        },
      },
    ],
  },
];

const sideId = (name: string) => `hist-c-${name.toLowerCase().replace(/\W+/g, "-")}`;

/** Write the history for one user. Re-running overwrites the same records. */
export async function seedHistory(userId: string): Promise<void> {
  const eventOf = Object.fromEntries(
    Object.entries(EVENTS).map(([key, e]) => [key, { id: `hist-${key}`, name: e.name, date: new Date(ago(e.daysAgo)).toISOString(), status: "ready", createdAt: ago(e.daysAgo, 9) } satisfies Event]),
  ) as Record<EventKey, Event>;
  for (const e of Object.values(eventOf)) await db.events.put(userId, e);

  for (const p of PEOPLE) {
    const contactId = `hist-c-${p.key}`;
    const eventKeys = [...new Set(p.meetings.map((m) => m.at))];
    const personId = (k: EventKey) => `hist-p-${p.key}-${k}`;
    for (const k of eventKeys) {
      await db.people.put(userId, {
        id: personId(k), eventId: eventOf[k].id, name: p.name, headline: p.headline, links: p.links,
        score: 0.8, why: p.why, dossierStatus: "ready", dossier: p.dossier, contactId,
      } satisfies Person);
    }
    await db.contacts.put(userId, {
      id: contactId, name: p.name, headline: p.headline, links: p.links,
      personIds: eventKeys.map(personId), eventIds: eventKeys.map((k) => eventOf[k].id), createdAt: ago(EVENTS[eventKeys[0]].daysAgo),
    } satisfies Contact);

    for (const [i, m] of p.meetings.entries()) {
      const id = `hist-cv-${p.key}-${i}`;
      const startedAt = ago(EVENTS[m.at].daysAgo, 20) + i * 600_000;
      // Others in a group chat get their own (thin) contact, dated to the chat so they don't jump to the top.
      for (const name of m.with ?? []) await db.contacts.put(userId, { id: sideId(name), name, links: [], personIds: [], eventIds: [eventOf[m.at].id], createdAt: startedAt });
      const transcript: Utterance[] = m.lines.map((text, j) => ({ speaker: j % 2 ? "me" : "them", text, at: startedAt + j * 12_000 }));
      await db.conversations.put(userId, {
        id, personId: personId(m.at), eventId: eventOf[m.at].id,
        participants: [{ name: p.name, personId: personId(m.at), contactId }, ...(m.with ?? []).map((name) => ({ name, contactId: sideId(name) }))],
        startedAt, endedAt: startedAt + m.lines.length * 12_000 + 30_000, transcript,
        hints: m.hints.map((text, j) => ({ id: `${id}-h${j}`, text, at: startedAt + (j * 2 + 1) * 12_000 })),
        linksShared: [],
        notes: { status: "ready", summary: m.summary, learned: m.learned, moments: m.moments, namesHeard: [p.name, ...(m.with ?? [])] },
      } satisfies Conversation);
      if (!m.followUp) continue;
      const f = m.followUp;
      await db.followUps.put(userId, {
        id: `hist-f-${p.key}-${i}`, conversationId: id, conversationIds: [id], personId: personId(m.at), contactId, eventId: eventOf[m.at].id,
        personName: p.name, summary: m.summary, promises: f.promises, theirPromises: f.theirPromises ?? [], learned: m.learned,
        draft: f.draft, dueAt: Date.now() + f.dueInDays * DAY, status: f.status, notesStatus: "ready",
      } satisfies FollowUp);
    }
  }
}
