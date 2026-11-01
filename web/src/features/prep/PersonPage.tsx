// Chunk 4 · One person's dossier + jump into live mode with them.
import { api } from "@larp/shared";
import { Link, useParams } from "react-router";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";

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
      <div>
        <h1 className="text-2xl font-bold">{p.name}</h1>
        {p.headline && <p className="text-muted">{p.headline}</p>}
      </div>

      {p.dossier ? (
        <div className="space-y-4">
          <p>{p.dossier.summary}</p>
          <Section title="Say this" items={p.dossier.openers} />
          <Section title="Common ground" items={p.dossier.commonGround} />
          <Section title="Into" items={p.dossier.interests} />
        </div>
      ) : (
        <button className="w-full rounded-lg bg-surface p-3" onClick={prep} disabled={p.dossierStatus === "pending"}>
          {p.dossierStatus === "pending" ? "Stalking (professionally)…" : "Build dossier"}
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
