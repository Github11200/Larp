// Chunk 2 · Full-screen card the other person can scan from across the table.
import type { Link } from "@larp/shared";
import { useMemo } from "react";
import { encode } from "uqr";

export function LinkCard({ link, onClose }: { link: Link; onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={`${link.label}: ${link.url}. Tap to dismiss`}
      className="pt-safe pb-safe fixed inset-0 z-20 flex flex-col items-center bg-fg px-6 text-bg"
    >
      <span className="self-start pt-2 text-[15px] font-semibold opacity-60">Here's my {link.kind === "other" ? "link" : link.kind}</span>
      <span className="flex w-full flex-1 flex-col items-center justify-center gap-5">
        <Qr text={link.url} />
        <span className="w-full text-center font-serif text-[2.5rem] leading-[1] tracking-[-0.015em] text-balance">{link.label}</span>
        <span className="w-full text-center text-[18px] font-medium break-all">{link.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
      </span>
      <span className="pb-2 text-[14px] opacity-60">tap to dismiss</span>
    </button>
  );
}

/** Dark modules on the bone card, as big as the screen allows, so it scans from across a table. */
function Qr({ text }: { text: string }) {
  // Low error correction = fewer, bigger modules = scans from further away. A phone screen doesn't get dirty.
  const { size, path } = useMemo(() => {
    const qr = encode(text, { ecc: "L", border: 0 });
    let d = "";
    qr.data.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x} ${y}h1v1h-1z`)));
    return { size: qr.size, path: d };
  }, [text]);
  return (
    <svg
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      role="img"
      aria-label="QR code"
      data-testid="link-qr"
      shapeRendering="crispEdges"
      className="aspect-square w-full max-w-[min(100%,52dvh)]"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
