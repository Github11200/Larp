// Chunk 1 · Keeps the screen on while live: a phone that dims mid-chat drops the mic and hides link cards.
import { useEffect } from "react";

export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock.request("screen").then((l) => (lock = l), () => {}); // unsupported or denied: just dims
    };
    acquire();
    document.addEventListener("visibilitychange", acquire); // the browser drops the lock when the tab hides
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [on]);
}
