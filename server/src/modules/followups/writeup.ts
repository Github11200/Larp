// Chunk 5 · One LLM call turns a transcript into notes + per-person promises and drafts.
import type { Conversation, Event, FollowUp, Profile } from "@larp/shared";
import { z } from "zod";
import { askJson, llmAvailable } from "../../lib/llm";
import { fallbackWriteUp, type WriteUp } from "./fallback";
import { firstName, sameWho, type Who } from "./participants";

const PersonOut = z.object({
  name: z.string(),
  myPromises: z.array(z.string()),
  theirPromises: z.array(z.string()),
  learned: z.array(z.string()),
  draft: z.string(),
  dueInDays: z.number(),
});

const Out = z.object({
  summary: z.string(),
  learned: z.array(z.string()),
  moments: z.array(z.string()),
  namesHeard: z.array(z.string()),
  people: z.array(PersonOut),
});

const RULES = `You turn a networking conversation into notes and follow-ups for the user ("me").
The mic can't tell speakers apart: lines marked "?" could be either side; infer from context.
Use only what was said in the transcript for facts (the dossier is background, not news). Refer to others as they/them.
Return JSON:
- summary: 1-2 punchy sentences, second person ("You and Sam nerded out about..."). Specific, no fluff.
- learned: up to 4 short facts the other people revealed (job, project, interests, asks).
- moments: up to 3 notable moments or tips for next time (a laugh, an ask, a link shared, a callback to use).
- namesHeard: first names of the other people mentioned as present (not the user), else [].
- people: exactly one entry per listed participant, same name as given (none listed = []):
  - myPromises: things I said I'd do for them, short verb phrases calling them "them" ("send them the deck"). Skip ones already in their open promises.
  - theirPromises: things they said they'd do for me, short verb phrases ("intro you to their CTO").
  - learned: up to 3 short facts this person revealed, as plain statements.
  - draft: the follow-up text I'll send when it's due. 2-4 short sentences, casual, sounds like a real person texting, first name only.
    Deliver on my promise in the message itself ("here's the deck: [link]") and mention one specific thing from the chat.
    No "hope this finds you well", no em dashes. Sign off with my first name.
  - dueInDays: when to send it (1 if I promised something "tomorrow", else 2-7).`;

export async function writeUp(
  conv: Conversation,
  who: Who[],
  profile: Profile | null,
  event: Event | null,
  open: FollowUp[],
): Promise<WriteUp> {
  const fallback = fallbackWriteUp(conv, who, profile, event);
  if (!llmAvailable) return fallback;
  try {
    const out = await askJson(Out, { model: "fast", system: RULES, prompt: prompt(conv, who, profile, event, open), maxTokens: 1500 });
    return merge(out, fallback, who);
  } catch (e) {
    console.error("[followups] LLM write-up failed, using fallback", e);
    return fallback;
  }
}

/** LLM people are matched back by name; anyone it skipped keeps the fallback. */
function merge(out: z.output<typeof Out>, fallback: WriteUp, who: Who[]): WriteUp {
  const people = new Map(fallback.people);
  for (const w of who) {
    const p = out.people.find((x) => x.name.toLowerCase() === w.name.toLowerCase()) ??
      out.people.find((x) => firstName(x.name).toLowerCase() === firstName(w.name).toLowerCase());
    if (p) people.set(w.name, { promises: p.myPromises, theirPromises: p.theirPromises, learned: p.learned, draft: p.draft, dueInDays: p.dueInDays });
  }
  return { summary: out.summary, learned: out.learned, moments: out.moments, namesHeard: out.namesHeard, people };
}

function prompt(conv: Conversation, who: Who[], profile: Profile | null, event: Event | null, open: FollowUp[]): string {
  const me = profile ? `${profile.name}: ${profile.headline}. ${profile.summary}` : "unknown";
  const people = who.length
    ? who
        .map((w) => {
          const d = w.person?.dossier;
          const earlier = open.find((f) => sameWho({ name: f.personName, personId: f.personId, contactId: f.contactId }, w))?.promises ?? [];
          return [
            `- ${w.name}${w.person?.headline ? ` (${w.person.headline})` : ""}`,
            d && `  dossier: ${d.summary} Interests: ${d.interests.join(", ")}. Common ground: ${d.commonGround.join(", ")}.`,
            earlier.length > 0 && `  open promises from before: ${earlier.join("; ")}`,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n")
    : "none named (notes only)";
  const label = { me: "me", them: "them", unknown: "?" } as const;
  const lines = conv.transcript.map((u) => `${label[u.speaker]}: ${u.text}`).join("\n");
  return [
    `Me: ${me}`,
    event && `Event: ${event.name}${event.description ? `. ${event.description}` : ""}`,
    `Participants:\n${people}`,
    conv.linksShared.length > 0 && `Links I shared: ${conv.linksShared.map((l) => `${l.label} ${l.url}`).join(", ")}`,
    `Transcript:\n${lines}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
