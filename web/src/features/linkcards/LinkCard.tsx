// Chunk 2 · Full-screen card the other person can scan from across the table.
import type { Link } from "@larp/shared";

export function LinkCard({ link, onClose }: { link: Link; onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="pt-safe pb-safe fixed inset-0 z-20 flex flex-col bg-fg px-6 text-left text-bg"
    >
      <span className="pt-4 text-[15px] font-semibold opacity-60">Here's my {link.kind}</span>
      <span className="flex flex-1 flex-col justify-center gap-6">
        {/* TODO(chunk 2): big QR code of link.url here, readable at arm's length. */}
        <span className="font-serif text-[3rem] leading-[1] tracking-[-0.015em] text-balance">{link.label}</span>
        <span className="text-[20px] font-medium break-all">{link.url.replace(/^https?:\/\//, "")}</span>
      </span>
      <span className="pb-4 text-center text-[14px] opacity-60">tap to dismiss</span>
    </button>
  );
}
