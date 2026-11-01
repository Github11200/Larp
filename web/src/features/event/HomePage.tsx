// Chunk 6 · `/`: straight into the event that matters right now.
import { api, type Event } from "@larp/shared";
import { Navigate } from "react-router";
import { Notice, Pending } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { friendlyError } from "../prep/format";
import { whenLabel } from "./journey";

/** Today's event if there is one, else the one added last. */
export const currentEvent = (es: Event[]) => es.find((e) => whenLabel(e) === "Today") ?? es.at(-1);

export function HomePage() {
  const events = useApi(api.listEvents);
  if (events.loading) return <Pending>Waking up your coach…</Pending>;
  if (events.error) return <Notice>{friendlyError(events.error)}</Notice>;
  const event = currentEvent(events.data ?? []);
  return <Navigate to={event ? paths.event(event.id) : paths.newEvent()} replace />;
}
