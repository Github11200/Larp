// Fetch a route and keep it fresh. `pollWhile` re-fetches while background work is pending
// (profile building, event prep, dossiers), so jobs show up without anyone wiring push updates.
import type { ResOf, RouteDef } from "@larp/shared";
import { useCallback, useEffect, useState } from "react";
import { call } from "./api";

export function useApi<D extends RouteDef>(
  def: D,
  params?: Record<string, string>,
  pollWhile?: (data: ResOf<D>) => boolean,
) {
  const [data, setData] = useState<ResOf<D>>();
  const [error, setError] = useState<string>();
  /** Failed fetches in a row. Bumping it re-arms the poll, so one dropped request can't freeze a pending screen. */
  const [failures, setFailures] = useState(0);
  const key = JSON.stringify(params ?? {});

  const reload = useCallback(
    () =>
      call(def, { params })
        .then((d) => (setData(d), setError(undefined), setFailures(0), d))
        .catch((e: Error) => {
          setError(e.message);
          setFailures((n) => n + 1);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [def, key],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // Poll off the latest data, so work started after mount (a manual reload()) is followed too.
  // After a failed fetch our copy may be stale, so retry with backoff (cold server, venue wifi blip) until one lands.
  useEffect(() => {
    const keepGoing = failures > 0 || (data !== undefined && pollWhile?.(data));
    if (!keepGoing) return;
    const timer = setTimeout(() => void reload(), Math.min(1500 * 2 ** failures, 15000));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, failures, reload]);

  return { data, error, reload, loading: data === undefined && !error };
}
