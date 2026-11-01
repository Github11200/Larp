// Chunk 6 · The building blocks every screen uses, so the whole app speaks one visual language.
import { ArrowLeft, Check, ChevronRight, CircleAlert, Ellipsis, FileUp, ImagePlus } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Link } from "react-router";

type Variant = "primary" | "secondary" | "ghost";

/** Square bone buttons, straight off the LarpHacks site. */
export function buttonClass(variant: Variant = "primary", extra = "") {
  const base =
    "inline-flex items-center justify-center gap-2 px-5 text-[15px] font-semibold transition-[opacity,background-color] duration-150 active:opacity-75 disabled:pointer-events-none disabled:opacity-40";
  const look = {
    primary: "min-h-12 bg-accent text-bg disabled:border disabled:border-line disabled:bg-transparent disabled:text-muted disabled:opacity-100",
    secondary: "min-h-12 border border-line text-fg active:bg-raise",
    ghost: "min-h-11 px-2 font-normal text-muted underline decoration-line",
  }[variant];
  return `${base} ${look} ${extra}`;
}

export function Button({ variant, className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ variant, className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export const fieldClass =
  "w-full border border-line bg-surface px-4 py-3 text-[16px] text-fg placeholder:text-muted focus:border-fg focus:outline-none";

/** Label above a form control. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="block text-[13px] font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

/** A line to say out loud, in upright Garamond (italic was too hard to read at a glance). */
export function Quote({ children }: { children: ReactNode }) {
  return <q className="block -indent-[0.4em] font-serif text-[1.5rem] leading-[1.2] text-pretty">{children}</q>;
}

/** Serif page title with an optional one-line meta under it. Keep `sub` to a few words. */
export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="space-y-1.5">
      <h1 className="text-display text-balance">{children}</h1>
      {sub && <p className="text-body text-muted text-pretty">{sub}</p>}
    </header>
  );
}

type Tone = "plain" | "live" | "done";

/** Tiny status tag on a row: "Dossier", "Met", "Due". One per row. */
export function Pill({ tone = "plain", children }: { tone?: Tone; children: ReactNode }) {
  const look = { plain: "border-line text-muted", live: "border-live/60 text-live", done: "border-fg/40 text-fg" }[tone];
  return <span className={`inline-flex h-6 shrink-0 items-center border px-2 text-meta whitespace-nowrap ${look}`}>{children}</span>;
}

/** The one list-row shape for people, events and chats: avatar or lead, name, one meta line, a pill. */
export function Row({
  to,
  onClick,
  lead,
  title,
  meta,
  trail,
  chevron = true,
}: {
  to?: string;
  onClick?: () => void;
  lead?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trail?: ReactNode;
  /** Off when `trail` already says what a tap does. */
  chevron?: boolean;
}) {
  const body = (
    <>
      {lead}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold">{title}</span>
        {meta && <span className="mt-0.5 line-clamp-2 block text-meta text-muted">{meta}</span>}
      </span>
      {trail}
      {chevron && (to || onClick) && <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />}
    </>
  );
  const cls = "flex w-full items-center gap-3 py-3 text-left active:bg-raise";
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/** Ruled list wrapper for Rows. */
export function Rows({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-line border-y border-line">
      {children}
    </ul>
  );
}

/** Quiet "⋯" menu for rare actions (rename, delete, regenerate) so they don't clutter the screen. */
export function Menu({ items, label = "More" }: { items: { label: string; onSelect: () => void; danger?: boolean }[]; label?: string }) {
  return (
    <details className="relative [&_summary::-webkit-details-marker]:hidden">
      <summary aria-label={label} className="grid size-10 cursor-pointer list-none place-items-center text-muted">
        <Ellipsis size={20} strokeWidth={1.75} />
      </summary>
      <div className="absolute right-0 z-30 mt-1 min-w-44 border border-line bg-raise py-1 shadow-2xl">
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            onClick={(e) => {
              (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
              it.onSelect();
            }}
            className={`block w-full px-4 py-3 text-left text-body ${it.danger ? "text-danger" : "text-fg"} active:bg-surface`}
          >
            {it.label}
          </button>
        ))}
      </div>
    </details>
  );
}

/** Segmented switch between a screen's views (an event's Prep / Live / Recap). */
export function Segmented<K extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: K;
  options: { key: K; label: ReactNode }[];
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="grid auto-cols-fr grid-flow-col border border-line">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`min-h-10 text-meta font-semibold ${value === o.key ? "bg-fg text-bg" : "text-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Background work in progress. Breathes instead of spinning. */
export function Pending({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-3 text-[15px] text-fg">
      <span className="size-2 animate-breathe rounded-full bg-live" aria-hidden />
      {children}
    </p>
  );
}

/** Small section label inside a screen (sentence case, not shouty). */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-[13px] font-semibold text-muted">{children}</h2>;
}

/** Event-page photo when there is one; initials when there isn't or it fails to load. */
export function Avatar({ name, photoUrl, size = "md" }: { name: string; photoUrl?: string; size?: "md" | "lg" }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const dims = size === "lg" ? "size-16 text-[1.75rem]" : "size-11 text-[1.15rem]";
  if (photoUrl && !broken) {
    return <img src={photoUrl} alt="" onError={() => setBroken(true)} className={`shrink-0 border border-line object-cover ${dims}`} />;
  }
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center border border-line bg-surface font-serif ${dims}`}>
      {initials}
    </span>
  );
}

/** First name, for friendly buttons ("Talk to Sam"). */
export const firstName = (name: string) => name.split(" ")[0];

/** Top-left way back on detail screens. */
export function BackLink({ to, label = "Back" }: { to: string; label?: string }) {
  return (
    <Link to={to} className="-ml-1 inline-flex min-h-10 items-center gap-1.5 text-[15px] text-muted">
      <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
      {label}
    </Link>
  );
}

/** The screen's main action, pinned in thumb reach just above the tab bar. */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 mx-auto flex max-w-md flex-col gap-2 bg-gradient-to-t from-bg via-bg/95 to-transparent px-5 pt-6 pb-3">
      {children}
    </div>
  );
}

/** Tap-to-pick file tile (resume PDF, guest-list screenshots). Shows what was picked. */
export function FilePick({
  label,
  picked,
  accept,
  multiple,
  icon = "file",
  onPick,
}: {
  label: string;
  picked?: string;
  accept: string;
  multiple?: boolean;
  icon?: "file" | "image";
  onPick: (files: FileList | null) => void;
}) {
  const Icon = picked ? Check : icon === "image" ? ImagePlus : FileUp;
  return (
    <label className={`flex min-h-14 cursor-pointer items-center gap-3 border border-dashed px-4 py-3 ${picked ? "border-fg" : "border-line"}`}>
      <Icon size={20} strokeWidth={1.75} className={picked ? "text-fg" : "text-muted"} aria-hidden />
      <span className={`flex-1 truncate text-[15px] ${picked ? "text-fg" : "text-muted"}`}>{picked ?? label}</span>
      <input type="file" accept={accept} multiple={multiple} className="sr-only" onChange={(e) => onPick(e.target.files)} />
    </label>
  );
}

/** Something went wrong: say what and how to recover, in the app's voice. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 text-[15px] text-danger">
      <CircleAlert size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
