// Chunk 6 · Brand-new users (nothing saved at all) land in the guided setup instead of an empty app.
import { api } from "@larp/shared";
import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useApi } from "../lib/useApi";
import { paths } from "../routes";
import { Pending } from "./ui";

export function FirstRunGate({ children }: { children: ReactNode }) {
  // Anyone with a trace of history (met people live, follow-ups, contacts) is not new.
  const checks = [
    useApi(api.getProfile),
    useApi(api.listEvents),
    useApi(api.listContacts),
    useApi(api.listConversations),
    useApi(api.listFollowUps),
  ];

  if (checks.some((c) => c.error)) return <>{children}</>;
  if (checks.some((c) => c.loading)) return <Pending>Waking up your coach…</Pending>;
  const isNew = checks.every((c) => !c.data || (Array.isArray(c.data) && c.data.length === 0));
  if (isNew) return <Navigate to={paths.setup()} replace />;
  return <>{children}</>;
}
