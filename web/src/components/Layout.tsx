// Chunk 6 · Phone-first shell: content + bottom tab bar with "Go live" always one tap away.
import { CalendarDays, Inbox, Mic, User, Users } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { NudgeBadge } from "../features/followups/NudgeBadge";
import { paths } from "../routes";

/** `also`: other screens that live under the tab (an event's person belongs to Events). */
const tabs = [
  { to: paths.home(), label: "Events", Icon: CalendarDays, also: ["/events", "/people/"] },
  { to: paths.contacts(), label: "People", Icon: Users, also: ["/contacts"] },
  { to: paths.followUps(), label: "Follow-ups", Icon: Inbox, also: [] },
  { to: paths.profile(), label: "Me", Icon: User, also: [] },
];

export function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="pt-safe flex-1 px-5 pb-32">
        <Outlet />
      </main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-stretch border-t border-line bg-bg/90 px-2 pt-2 backdrop-blur-md">
        {tabs.map(({ to, label, Icon, also }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive || also.some((p) => pathname.startsWith(p)) ? "text-fg" : "text-muted"}`
            }
          >
            <Icon size={22} strokeWidth={1.75} aria-hidden />
            {label}
            {to === paths.followUps() && <NudgeBadge />}
          </NavLink>
        ))}
        <Link to={paths.live()} className="ml-2 flex items-center gap-2 bg-accent px-4 text-[15px] font-semibold text-bg active:opacity-75">
          <Mic size={18} strokeWidth={2} aria-hidden />
          Go live
        </Link>
      </nav>
    </div>
  );
}
