// Chunk 6 · The building blocks every screen uses, so the whole app speaks one visual language.
import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router";

type Variant = "primary" | "secondary" | "ghost";

/** Square bone buttons, straight off the LarpHacks site. */
export function buttonClass(variant: Variant = "primary", extra = "") {
  const base =
    "inline-flex min-h-12 items-center justify-center gap-2 px-5 text-[15px] font-semibold transition-[opacity,background-color] duration-150 active:opacity-75 disabled:pointer-events-none disabled:opacity-40";
  const look = {
    primary: "bg-accent text-bg",
    secondary: "border border-line text-fg active:bg-raise",
    ghost: "min-h-10 px-2 font-normal text-muted underline decoration-line",
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

/** Initials in a square, for people without photos. */
export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const dims = size === "lg" ? "size-16 text-[1.75rem]" : "size-11 text-[1.15rem]";
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center border border-line bg-surface font-serif ${dims}`}>
      {initials}
    </span>
  );
}

/** First name, for friendly buttons ("Talk to Sam"). */
export const firstName = (name: string) => name.split(" ")[0];
