// Demo data so every chunk can be built and demoed before upstream chunks exist.
// Loaded per user via POST /api/dev/seed (or `npm run sim`). All people are fictional.
import type { Event, Person, Profile } from "./models";

export const demoProfile: Profile = {
  id: "me",
  name: "Alex Rivera",
  headline: "CS student building voice AI tools",
  summary: "Second-year CS student. Builds hackathon projects with realtime voice and LLMs. Into tennis and climbing.",
  skills: ["TypeScript", "React", "Node", "LLM apps", "Realtime audio"],
  projects: [
    { name: "Larp Coach", description: "Earpiece that whispers what to say at networking events", url: "https://example.com/larp" },
    { name: "Rally", description: "App to find tennis partners nearby", url: "https://example.com/rally" },
  ],
  links: [
    { kind: "demo", label: "Larp Coach demo", url: "https://example.com/larp" },
    { kind: "github", label: "GitHub", url: "https://github.com/example" },
    { kind: "linkedin", label: "LinkedIn", url: "https://linkedin.com/in/example" },
    { kind: "portfolio", label: "Portfolio", url: "https://example.com" },
  ],
  status: "ready",
};

export const demoEvent: Event = {
  id: "evt-demo",
  name: "Demo Night: AI Builders",
  url: "https://lu.ma/example",
  description: "Founders and students demoing AI side projects.",
  date: "2026-11-01",
  status: "ready",
};

export const demoPeople: Person[] = [
  {
    id: "p-sam",
    eventId: demoEvent.id,
    name: "Sam Chen",
    headline: "Founder, VoiceKit (YC)",
    links: ["https://linkedin.com/in/sam-example"],
    score: 0.92,
    why: "Builds voice infra; you both work on realtime audio.",
    dossierStatus: "ready",
    dossier: {
      summary: "Runs a voice-infra startup. Ex-Google speech team. Hiring interns.",
      workingOn: ["Low-latency speech APIs", "Hiring summer interns"],
      interests: ["Tennis", "Bouldering", "Synths"],
      commonGround: ["Realtime voice", "Tennis"],
      openers: [
        "How do you get speech latency under 200ms?",
        "Saw you play tennis, ever tried Rally?",
      ],
    },
  },
  {
    id: "p-priya",
    eventId: demoEvent.id,
    name: "Priya Patel",
    headline: "ML engineer at a fintech",
    links: [],
    score: 0.71,
    why: "Ships LLM features in production; good for career advice.",
    dossierStatus: "ready",
    dossier: {
      summary: "Builds LLM-powered fraud review tools. Mentors at hackathons.",
      workingOn: ["LLM evals", "Fraud review copilots"],
      interests: ["Hackathons", "Running"],
      commonGround: ["LLM apps", "Hackathons"],
      openers: ["How do you evaluate LLM features before shipping?"],
    },
  },
  {
    id: "p-jordan",
    eventId: demoEvent.id,
    name: "Jordan Lee",
    headline: "Product designer",
    links: [],
    score: 0.4,
    why: "Could give feedback on the coach UI.",
    dossierStatus: "none",
  },
];
