// Earbud/headset button (play/pause/next) = "they just spoke, help me respond."
// Best effort by design: browsers only route media keys to a page that owns the "now playing" session,
// which takes a playing <audio>/<video>. We deliberately don't add one: a looping media element while the
// mic records can switch the iOS audio session (routing, echo cancellation) and hurt the automatic hints.
// Whispers play through Web Audio, which usually doesn't claim the session (Android Chrome never does),
// so on most phones these handlers stay idle and the on-screen button is the reliable trigger.
import { useEffect, useRef } from "react";

const ACTIONS: MediaSessionAction[] = ["play", "pause", "nexttrack"];

export function useHeadsetNudge(active: boolean, onNudge: () => void) {
  const cb = useRef(onNudge);
  cb.current = onNudge;

  useEffect(() => {
    if (!active || !("mediaSession" in navigator)) return;
    const set = (handler: MediaSessionActionHandler | null) => {
      for (const a of ACTIONS) {
        try {
          navigator.mediaSession.setActionHandler(a, handler);
        } catch {
          // this browser doesn't support that action
        }
      }
    };
    set(() => cb.current());
    return () => set(null);
  }, [active]);
}
