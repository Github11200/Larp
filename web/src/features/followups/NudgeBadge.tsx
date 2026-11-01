// Chunk 5 · Count of follow-ups that are due, on the Follow-ups tab. Recounts on navigation and on changes.
import { api } from "@larp/shared";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { call } from "../../lib/api";
import { isDue, onChange } from "./shared";

export function NudgeBadge() {
  const { pathname } = useLocation();
  const [due, setDue] = useState(0);

  useEffect(() => {
    const count = () => void call(api.listFollowUps).then((l) => setDue(l.filter(isDue).length), () => {});
    count();
    const timer = setInterval(count, 30_000);
    const off = onChange(count);
    return () => (clearInterval(timer), off());
  }, [pathname]);

  if (!due) return null;
  return (
    <span data-testid="nudge-badge" className="absolute top-0 left-1/2 ml-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-live px-1 text-[11px] font-bold text-bg">
      {due}
    </span>
  );
}
