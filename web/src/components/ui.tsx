// Chunk 6 · The building blocks every screen uses, so the whole app speaks one visual language.
import { ArrowLeft, Check, CircleAlert, FileUp, ImagePlus } from "lucide-react";
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

/** A line to say out loud, in Garamond italic: the app's signature voice for coached lines. */
export function Quote({ children }: { children: ReactNode }) {
  return <q className="block -indent-[0.4em] font-serif text-[1.5rem] leading-[1.2] italic text-pretty">{children}</q>;
}

/** Serif page title with an optional plain-language line under it. */
export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="space-y-2">
      <h1 className="font-serif text-[2.5rem] leading-[1.05] tracking-[-0.01em] text-balance">{children}</h1>
      {sub && <p className="text-[15px] leading-snug text-muted text-pretty">{sub}</p>}
    </header>
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
