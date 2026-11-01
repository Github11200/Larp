// Chunk 6 · Chrome for each setup step: back, progress, content, and a thumb-reach action bar.
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { SetupStep } from "../../routes";

export const STEPS: { step: SetupStep; label: string }[] = [
  { step: "you", label: "You" },
  { step: "event", label: "Event" },
  { step: "people", label: "People" },
];

export function SetupFrame({ step, back, children, actions }: { step: SetupStep; back: string; children: ReactNode; actions?: ReactNode }) {
  const current = STEPS.findIndex((s) => s.step === step);
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="pt-safe flex items-center gap-4 px-5 pb-2">
        <Link to={back} aria-label="Back" className="-ml-2 grid size-10 place-items-center text-muted">
          <ArrowLeft size={22} strokeWidth={1.75} />
        </Link>
        <ol className="flex flex-1 gap-1.5" aria-label={`Step ${current + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s.step} className="flex-1">
              <span className={`block h-[3px] ${i <= current ? "bg-fg" : "bg-line"}`} />
              <span className={`mt-1.5 block text-meta ${i === current ? "text-fg" : "text-muted"}`}>{s.label}</span>
            </li>
          ))}
        </ol>
      </header>
      <main className="flex-1 px-5 pt-4 pb-36">{children}</main>
      {actions && (
        <footer className="pb-safe fixed inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-2 border-t border-line bg-bg/90 px-5 pt-3 backdrop-blur-md">
          {actions}
        </footer>
      )}
    </div>
  );
}
