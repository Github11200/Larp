// Chunk 6 · Phone-first shell: content + three tabs. Going live happens from an event, so it knows where you are.
import { CalendarDays, User, Users } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router";
import { NudgeBadge } from "../features/followups/NudgeBadge";
import { paths } from "../routes";

/** `also`: other screens that live under the tab (an event's person and its follow-ups belong to Events). */
const tabs = [
  { to: paths.events(), label: "Events", Icon: CalendarDays, also: ["/events", "/people/", "/followups"] },
  { to: paths.contacts(), label: "People", Icon: Users, also: ["/contacts"] },
  { to: paths.profile(), label: "Me", Icon: User, also: [] },
];

export function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="pt-safe flex-1 px-5 pb-32">
        <Outlet />
      </main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-stretch border-t border-line bg-bg/90 pt-2 backdrop-blur-md">
        {tabs.map(({ to, label, Icon, also }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive || also.some((p) => pathname.startsWith(p)) ? "text-fg" : "text-muted"}`
            }
          >
            <Icon size={22} strokeWidth={1.75} aria-hidden />
            {label}
            {to === paths.events() && <NudgeBadge />}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
