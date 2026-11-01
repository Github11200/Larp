// Chunk 6 · Everything one event's hub needs: the event, its guest list, its chats and follow-ups.
import { api } from "@larp/shared";
import { useApi } from "../../lib/useApi";
import { metIds, splitByMet, strangerChats } from "./journey";

export function useEventJourney(eventId: string) {
  const events = useApi(api.listEvents, undefined, (es) => es.some((e) => e.status === "pending"));
  const event = events.data?.find((e) => e.id === eventId);
  // Keyed on status so the list re-fetches the moment prep finishes.
  const people = useApi(api.listPeople, { id: eventId, status: event?.status ?? "" }, (ps) => ps.some((p) => p.dossierStatus === "pending"));
  const convs = useApi(api.listConversations, undefined, (cs) => cs.some((c) => c.eventId === eventId && (!c.notes || c.notes.status === "pending")));
  const fus = useApi(api.listFollowUps, undefined, (fs) => fs.some((f) => f.eventId === eventId && f.notesStatus === "pending"));

  const chats = (convs.data ?? []).filter((c) => c.eventId === eventId).sort((a, b) => b.startedAt - a.startedAt);
  const followUps = (fus.data ?? []).filter((f) => f.eventId === eventId);
  const ranked = people.data ?? [];
  const met = metIds(chats, followUps);

  return {
    events,
    event,
    loading: events.loading,
    people: ranked,
    peopleLoading: people.loading,
    chats,
    allChats: convs.data ?? [],
    followUps,
    strangers: strangerChats(chats),
    met,
    ...splitByMet(ranked, met),
    reload: () => Promise.all([events.reload(), people.reload(), convs.reload(), fus.reload()]),
  };
}

export type Journey = ReturnType<typeof useEventJourney>;
