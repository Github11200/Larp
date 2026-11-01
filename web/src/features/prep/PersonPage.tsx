// Chunk 4 · One person's dossier + jump into live mode with them.
import { api } from "@larp/shared";
import { Link, useParams } from "react-router";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";
import { Avatar } from "./Avatar";

export function PersonPage() {
  const { id = "" } = useParams();
  const person = useApi(api.getPerson, { id }, (p) => p.dossierStatus === "pending");
  const p = person.data;
  if (!p) return <p className="text-muted">{person.error ?? "Loading…"}</p>;

  const prep = async () => {
    await call(api.requestDossier, { params: { id } });
    void person.reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar person={p} size={64} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{p.name}</h1>
          {p.headline && <p className="text-muted">{p.headline}</p>}
        </div>
      </div>
      {p.why && <p className="text-accent">{p.why}</p>}
      {p.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {p.links.map((l) => (
            <a key={l} href={l} target="_blank" rel="noreferrer" className="rounded-full bg-surface px-3 py-1 text-sm text-muted">
              {new URL(l).hostname.replace(/^www\./, "")}
            </a>
          ))}
        </div>
      )}

      {p.dossier ? (
        <div className="space-y-4">
          <p>{p.dossier.summary}</p>
          <Section title="Say this" items={p.dossier.openers} />
          <Section title="Working on" items={p.dossier.workingOn} />
          <Section title="Common ground" items={p.dossier.commonGround} />
          <Section title="Into" items={p.dossier.interests} />
        </div>
      ) : (
        <button className="w-full rounded-lg bg-surface p-3" onClick={prep} disabled={p.dossierStatus === "pending"}>
          {p.dossierStatus === "pending"
            ? "Stalking (professionally)…"
            : p.dossierStatus === "error"
              ? "Research failed. Try again?"
              : "Build dossier"}
        </button>
      )}

      <Link to={paths.live(p.id)} className="block rounded-full bg-accent p-4 text-center font-semibold text-bg">
        Talk to {p.name.split(" ")[0]}
      </Link>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h2 className="text-sm uppercase tracking-wide text-muted">{title}</h2>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
