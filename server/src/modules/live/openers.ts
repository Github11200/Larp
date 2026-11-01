// Chunk 1 · "Say this" lines shown before the first hint: dossier openers for people you prepped,
// event-flavoured general ones for strangers and groups. Sync and cheap: re-sent whenever who's there changes.
import type { LiveContext } from "./session";

const MAX = 3;

export function openersFor(ctx: Pick<LiveContext, "person" | "people" | "event" | "conversation">): string[] {
  const known = [ctx.person, ...ctx.people.filter((p) => p !== ctx.person)].filter((p) => p !== null);
  const fromDossiers = known.flatMap((p) => p.dossier?.openers.slice(0, known.length > 1 ? 1 : MAX) ?? []);
  // Anyone without a dossier (strangers, names caught mid-chat, prep still cooking) gets general openers.
  const strangers = ctx.conversation.participants.length === 0 || ctx.conversation.participants.length > known.filter((p) => p.dossier).length;
  return [...fromDossiers, ...(strangers ? general(ctx) : [])].slice(0, MAX);
}

function general(ctx: Pick<LiveContext, "event" | "conversation">): string[] {
  const unnamed = ctx.conversation.participants.length === 0;
  return [
    ...(unnamed ? ["Hey, I'm terrible at names, what's yours?"] : []),
    ctx.event ? `What brought you to ${ctx.event.name}?` : "What brought you here tonight?",
    "What are you building right now?",
  ];
}
