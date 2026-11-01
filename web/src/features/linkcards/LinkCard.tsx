// Chunk 2 · Full-screen card the other person can scan from across the table.
import type { Link } from "@larp/shared";

export function LinkCard({ link, onClose }: { link: Link; onClose: () => void }) {
  // TODO(chunk 2): big QR code of link.url, readable at arm's length.
  return (
    <button onClick={onClose} className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-fg p-8 text-bg">
      <div className="text-sm uppercase tracking-wide">{link.kind}</div>
      <div className="text-3xl font-bold">{link.label}</div>
      <div className="break-all text-lg">{link.url}</div>
      <div className="text-sm opacity-60">tap to dismiss</div>
    </button>
  );
}
