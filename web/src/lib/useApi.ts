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
  const key = JSON.stringify(params ?? {});

  const reload = useCallback(
    () =>
      call(def, { params })
        .then((d) => (setData(d), setError(undefined), d))
        .catch((e: Error) => void setError(e.message)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [def, key],
  );

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const d = await reload();
      if (!stop && d !== undefined && pollWhile?.(d)) timer = setTimeout(tick, 1500);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  return { data, error, reload, loading: data === undefined && !error };
}
