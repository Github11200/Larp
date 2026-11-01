import type { Person } from "@larp/shared";

/** Photo from the event page, or initials when there isn't one. */
export function Avatar({ person, size }: { person: Pick<Person, "name" | "photoUrl">; size: number }) {
  const style = { width: size, height: size };
  if (person.photoUrl) return <img src={person.photoUrl} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  const initials = person.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div style={style} className="flex shrink-0 items-center justify-center rounded-full bg-bg text-sm font-semibold text-muted">
      {initials}
    </div>
  );
}
