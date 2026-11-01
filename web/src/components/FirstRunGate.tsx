// Chunk 6 · Brand-new users (no profile, no event) land in the guided setup instead of an empty app.
import { api } from "@larp/shared";
import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useApi } from "../lib/useApi";
import { paths } from "../routes";
import { Pending } from "./ui";

export function FirstRunGate({ children }: { children: ReactNode }) {
  const profile = useApi(api.getProfile);
  const events = useApi(api.listEvents);

  if (profile.error || events.error) return <>{children}</>;
  if (profile.loading || events.loading) return <Pending>Waking up your coach…</Pending>;
  if (!profile.data && events.data?.length === 0) return <Navigate to={paths.setup()} replace />;
  return <>{children}</>;
}
