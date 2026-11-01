// Chunk 6 · Phone-first shell: content + bottom nav + a big "Go live" button.
import { Link, NavLink, Outlet } from "react-router";
import { paths } from "../routes";

const tabs = [
  { to: paths.home(), label: "People" },
  { to: paths.followUps(), label: "Follow-ups" },
  { to: paths.profile(), label: "Me" },
];

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pt-6 pb-28">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center gap-2 border-t border-white/10 bg-bg/95 px-4 py-3">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end
            className={({ isActive }) => `flex-1 text-center text-sm ${isActive ? "text-fg" : "text-muted"}`}
          >
            {t.label}
          </NavLink>
        ))}
        <Link to={paths.live()} className="rounded-full bg-accent px-5 py-2 font-semibold text-bg">
          Go live
        </Link>
      </nav>
    </div>
  );
}
