// Detects both volume buttons pressed within a short window on mobile.
// Uses a silent audio element so hardware buttons fire volumechange events.
// Falls back gracefully: if the browser doesn't support it, the hook is a no-op.
import { useEffect, useRef } from "react";

const WINDOW_MS = 600;

export function useVolumeNudge(active: boolean, onNudge: () => void) {
  const cb = useRef(onNudge);
  cb.current = onNudge;

  useEffect(() => {
    if (!active) return;

    const audio = document.createElement("audio");
    // Tiny silent WAV so the element counts as "media" and volume buttons control media volume.
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    audio.loop = true;
    audio.volume = 0.01;
    // Play may be blocked until a gesture; that's fine — the LivePage Start tap already happened.
    audio.play().catch(() => {});

    let lastDir: "up" | "down" | null = null;
    let lastAt = 0;
    let prevVol = audio.volume;

    const onVolumeChange = () => {
      const now = Date.now();
      const vol = audio.volume;
      const dir = vol > prevVol ? "up" : vol < prevVol ? "down" : null;
      prevVol = vol;
      if (!dir) return;

      if (lastDir && lastDir !== dir && now - lastAt < WINDOW_MS) {
        lastDir = null;
        lastAt = 0;
        cb.current();
      } else {
        lastDir = dir;
        lastAt = now;
      }
    };

    audio.addEventListener("volumechange", onVolumeChange);

    return () => {
      audio.removeEventListener("volumechange", onVolumeChange);
      audio.pause();
      audio.removeAttribute("src");
    };
  }, [active]);
}
