// Chunk 6 · Phone-first shell: content + bottom tab bar with "Go live" always one tap away.
import { Inbox, Mic, User, Users } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";
import { NudgeBadge } from "../features/followups/NudgeBadge";
import { paths } from "../routes";

const tabs = [
  { to: paths.home(), label: "People", Icon: Users },
  { to: paths.followUps(), label: "Follow-ups", Icon: Inbox },
  { to: paths.profile(), label: "Me", Icon: User },
];

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="pt-safe flex-1 px-5 pb-32">
        <Outlet />
      </main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-stretch border-t border-line bg-bg/90 px-2 pt-2 backdrop-blur-md">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive ? "text-fg" : "text-muted"}`
            }
          >
            <Icon size={22} strokeWidth={1.75} aria-hidden />
            {label}
            {to === paths.followUps() && <NudgeBadge />}
          </NavLink>
        ))}
        <Link to={paths.live()} className="ml-2 flex items-center gap-2 bg-accent px-5 text-[15px] font-semibold text-bg active:opacity-75">
          <Mic size={18} strokeWidth={2} aria-hidden />
          Go live
        </Link>
      </nav>
    </div>
  );
}
