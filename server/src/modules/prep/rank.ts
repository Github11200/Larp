// Rank everyone in one LLM call: who is worth your limited time at this event, and why.
import type { Event, Profile } from "@larp/shared";
import { z } from "zod";
import { askJson, llmAvailable } from "../../lib/llm";
import { cached } from "./cache";
import type { Guest } from "./sources";

/** More than this and the prompt gets slow; the rest stay unranked. */
const MAX_RANKED = 80;

const Ranking = z.object({
  ranked: z.array(z.object({ i: z.number(), score: z.number(), why: z.string() })),
});

export type Rank = { score?: number; why?: string };

export async function rankGuests(guests: Guest[], profile: Profile | null, event: Event): Promise<Rank[]> {
  if (!llmAvailable || !guests.length) return guests.map(() => ({}));
  const list = guests
    .slice(0, MAX_RANKED)
    .map((g, i) => `${i}. ${g.name}${g.headline ? ` (${g.headline})` : ""}`)
    .join("\n");
  const me = profile ? `${profile.name}: ${profile.headline}. ${profile.summary} Skills: ${profile.skills.join(", ")}` : "unknown";
  const { ranked } = await cached("rank", { list, me, event: event.name }, () =>
    askJson(Ranking, {
      prompt:
        `I'm going to "${event.name}". ${event.description ?? ""}\n\nMe: ${me}\n\nGuests:\n${list}\n\n` +
        "Score every guest 0-1 on how worth meeting they are for me (shared interests, could hire/help/teach me, hosts matter). " +
        "why = one punchy line, max 12 words, speaking to me (e.g. 'Hires voice AI interns; you just built one'). " +
        "Guests with no info: score low, why = a playful guess.",
      maxTokens: 4000,
    }),
  );
  const byIndex = new Map(ranked.map((r) => [r.i, r]));
  return guests.map((_, i) => {
    const r = byIndex.get(i);
    return r ? { score: Math.max(0, Math.min(1, r.score)), why: r.why } : {};
  });
}
