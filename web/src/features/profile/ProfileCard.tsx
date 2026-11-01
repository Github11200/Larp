// Chunk 3 · The profile the coach and link cards use. Reads clean; one Edit toggle makes every field tap-to-edit.
import { LinkKind, type Profile } from "@larp/shared";
import { Check, ChevronDown, Pencil, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Pill, Row, Rows, SectionLabel } from "../../components/ui";
import { Chips } from "../prep/Dossier";
import { Editable } from "./Editable";

export function ProfileCard({ profile: p, onSave }: { profile: Profile; onSave: (patch: Partial<Profile>) => void }) {
  const [editing, setEditing] = useState(false);
  const setProject = (i: number, patch: Partial<Profile["projects"][number]> | null) =>
    onSave({ projects: p.projects.flatMap((x, j) => (j !== i ? [x] : patch ? [{ ...x, ...patch }] : [])) });
  const setLink = (i: number, patch: Partial<Profile["links"][number]> | null) =>
    onSave({ links: p.links.flatMap((x, j) => (j !== i ? [x] : patch ? [{ ...x, ...patch }] : [])) });

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1">
            <Editable
              editing={editing}
              label="name"
              className="text-display text-balance"
              editClassName="font-serif text-title!"
              value={p.name}
              placeholder="Your name"
              onSave={(name) => onSave({ name })}
            />
          </h1>
          <button
            type="button"
            aria-pressed={editing}
            onClick={() => setEditing(!editing)}
            className={`-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-body ${editing ? "font-semibold text-fg" : "text-muted"}`}
          >
            {editing ? <Check size={16} strokeWidth={2} aria-hidden /> : <Pencil size={14} strokeWidth={1.75} aria-hidden />}
            {editing ? "Done" : "Edit"}
          </button>
        </div>
        <Editable editing={editing} label="headline" className="text-body text-muted" value={p.headline} placeholder="One-line headline" onSave={(headline) => onSave({ headline })} />
        {editing && <p className="text-meta text-muted">Tap a field to fix it. Saves as you go.</p>}
      </header>

      <Section title="The pitch" show={editing || Boolean(p.summary)}>
        <Editable
          editing={editing}
          multiline
          label="pitch"
          className="text-body text-pretty"
          value={p.summary}
          placeholder="2-3 sentences about you"
          onSave={(summary) => onSave({ summary })}
        />
      </Section>

      <Section title="Skills" show={editing || p.skills.length > 0}>
        <Editable
          editing={editing}
          label="skills, comma separated"
          value={p.skills.join(", ")}
          placeholder="Comma-separated skills"
          display={<Chips items={p.skills} />}
          onSave={(v) => onSave({ skills: v.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </Section>

      <Section
        title="Projects"
        show={editing || p.projects.length > 0}
        add={editing ? { label: "Add project", onAdd: () => onSave({ projects: [...p.projects, { name: "New project", description: "" }] }) } : undefined}
      >
        <Rows>
          {p.projects.map((x, i) =>
            editing ? (
              <EditRow key={i} name={x.name || "project"} onRemove={() => setProject(i, null)}>
                <Editable editing label="project name" className="text-body font-semibold" value={x.name} placeholder="Name" onSave={(name) => setProject(i, { name })} />
                <Editable editing label="project description" className="text-body" value={x.description} placeholder="What it is" onSave={(description) => setProject(i, { description })} />
                <Editable
                  editing
                  label="project link"
                  className="text-meta break-all text-muted"
                  value={x.url ?? ""}
                  placeholder="Link (optional)"
                  onSave={(url) => setProject(i, { url: url || undefined })}
                />
              </EditRow>
            ) : (
              <li key={i}>
                <Row title={x.name} meta={x.description} />
              </li>
            ),
          )}
        </Rows>
      </Section>

      <Section
        title="Links · pop up as QR cards"
        show={editing || p.links.length > 0}
        add={editing ? { label: "Add link", onAdd: () => onSave({ links: [...p.links, { kind: "other", label: "New link", url: "" }] }) } : undefined}
      >
        <Rows>
          {p.links.map((l, i) =>
            editing ? (
              <EditRow key={i} name={l.label || "link"} onRemove={() => setLink(i, null)}>
                <div className="flex items-center gap-3">
                  <KindSelect value={l.kind} onChange={(kind) => setLink(i, { kind })} />
                  <div className="min-w-0 flex-1">
                    <Editable editing label="link label" className="text-body font-semibold" value={l.label} placeholder="Label" onSave={(label) => setLink(i, { label })} />
                  </div>
                </div>
                <Editable editing label="link URL" className="text-meta break-all text-muted" value={l.url} placeholder="https://…" onSave={(url) => setLink(i, { url })} />
              </EditRow>
            ) : (
              <li key={i}>
                <Row title={l.label} meta={l.url.replace(/^https?:\/\/(www\.)?/, "")} trail={<Pill>{l.kind}</Pill>} />
              </li>
            ),
          )}
        </Rows>
      </Section>
    </div>
  );
}

function Section({
  title,
  show,
  add,
  children,
}: {
  title: string;
  show: boolean;
  add?: { label: string; onAdd: () => void };
  children: ReactNode;
}) {
  if (!show) return null;
  return (
    <section className="space-y-3">
      <div className={`flex items-center justify-between gap-3 ${add ? "min-h-11" : ""}`}>
        <SectionLabel>{title}</SectionLabel>
        {add && (
          <button type="button" className="-mr-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-meta text-fg" onClick={add.onAdd}>
            <Plus size={16} strokeWidth={1.75} aria-hidden />
            {add.label}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function EditRow({ name, onRemove, children }: { name: string; onRemove: () => void; children: ReactNode }) {
  return (
    <li className="flex gap-2 py-3">
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" aria-label={`Remove ${name}`} className="-mr-2 grid size-11 shrink-0 place-items-center text-muted" onClick={onRemove}>
        <X size={18} strokeWidth={1.75} aria-hidden />
      </button>
    </li>
  );
}

/** Link type is what live mode matches on ("got a demo?" -> the demo link), so it must be right. */
function KindSelect({ value, onChange }: { value: LinkKind; onChange: (k: LinkKind) => void }) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label="Link type"
        className="min-h-11 appearance-none border border-line bg-bg pr-9 pl-3 text-meta text-fg focus:border-fg focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value as LinkKind)}
      >
        {LinkKind.options.map((k) => (
          <option key={k}>{k}</option>
        ))}
      </select>
      <ChevronDown size={16} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
    </span>
  );
}
