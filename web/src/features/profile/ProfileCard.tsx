// Chunk 3 · The profile the coach and link cards use. Every field is tap-to-edit and saves immediately.
import { LinkKind, type Profile } from "@larp/shared";
import { Editable } from "./Editable";

export function ProfileCard({ profile: p, onSave }: { profile: Profile; onSave: (patch: Partial<Profile>) => void }) {
  const setProject = (i: number, patch: Partial<Profile["projects"][number]> | null) =>
    onSave({ projects: p.projects.flatMap((x, j) => (j !== i ? [x] : patch ? [{ ...x, ...patch }] : [])) });
  const setLink = (i: number, patch: Partial<Profile["links"][number]> | null) =>
    onSave({ links: p.links.flatMap((x, j) => (j !== i ? [x] : patch ? [{ ...x, ...patch }] : [])) });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Editable className="text-2xl font-bold" value={p.name} placeholder="Your name" onSave={(name) => onSave({ name })} />
        <Editable className="text-muted" value={p.headline} placeholder="One-line headline" onSave={(headline) => onSave({ headline })} />
      </div>

      <Section title="The pitch">
        <Editable multiline className="text-sm" value={p.summary} placeholder="2-3 sentences about you" onSave={(summary) => onSave({ summary })} />
      </Section>

      <Section title="Skills">
        <Editable
          className="text-sm"
          value={p.skills.join(", ")}
          placeholder="Comma-separated skills"
          onSave={(v) => onSave({ skills: v.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </Section>

      <Section title="Projects" onAdd={() => onSave({ projects: [...p.projects, { name: "New project", description: "" }] })}>
        {p.projects.map((x, i) => (
          <Row key={i} onRemove={() => setProject(i, null)}>
            <Editable className="font-semibold" value={x.name} placeholder="Name" onSave={(name) => setProject(i, { name })} />
            <Editable className="text-sm" value={x.description} placeholder="What it is" onSave={(description) => setProject(i, { description })} />
            <Editable className="text-xs text-muted" value={x.url ?? ""} placeholder="Link" onSave={(url) => setProject(i, { url: url || undefined })} />
          </Row>
        ))}
      </Section>

      <Section title="Links (QR cards)" onAdd={() => onSave({ links: [...p.links, { kind: "other", label: "New link", url: "" }] })}>
        {p.links.map((l, i) => (
          <Row key={i} onRemove={() => setLink(i, null)}>
            <div className="flex items-center gap-2">
              <select
                aria-label="Link type"
                className="rounded bg-bg px-1 py-0.5 text-xs text-accent"
                value={l.kind}
                onChange={(e) => setLink(i, { kind: e.target.value as LinkKind })}
              >
                {LinkKind.options.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <Editable className="font-semibold" value={l.label} placeholder="Label" onSave={(label) => setLink(i, { label })} />
            </div>
            <Editable className="text-xs text-muted break-all" value={l.url} placeholder="https://…" onSave={(url) => setLink(i, { url })} />
          </Row>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, onAdd, children }: { title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
        {onAdd && (
          <button className="text-sm text-accent" onClick={onAdd}>
            + Add
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg bg-surface p-3">
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
      <button aria-label="Remove" className="self-start px-1 text-muted" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}
