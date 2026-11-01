// Chunk 3 · The profile the coach and link cards use. Every field is tap-to-edit and saves immediately.
import { LinkKind, type Profile } from "@larp/shared";
import { ChevronDown, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { SectionLabel } from "../../components/ui";
import { Editable } from "./Editable";

export function ProfileCard({ profile: p, onSave }: { profile: Profile; onSave: (patch: Partial<Profile>) => void }) {
  const setProject = (i: number, patch: Partial<Profile["projects"][number]> | null) =>
    onSave({ projects: p.projects.flatMap((x, j) => (j !== i ? [x] : patch ? [{ ...x, ...patch }] : [])) });
  const setLink = (i: number, patch: Partial<Profile["links"][number]> | null) =>
    onSave({ links: p.links.flatMap((x, j) => (j !== i ? [x] : patch ? [{ ...x, ...patch }] : [])) });

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1>
          <Editable
            label="name"
            className="font-serif text-[2.5rem] leading-[1.05] tracking-[-0.01em] text-balance"
            editClassName="font-serif text-[2rem]!"
            value={p.name}
            placeholder="Your name"
            onSave={(name) => onSave({ name })}
          />
        </h1>
        <Editable label="headline" className="text-[16px] text-muted" value={p.headline} placeholder="One-line headline" onSave={(headline) => onSave({ headline })} />
        <p className="pt-2 text-[14px] text-muted">This is what the coach knows about you. Tap anything it got wrong.</p>
      </header>

      <Section title="The pitch">
        <Editable
          multiline
          label="pitch"
          className="text-[16px] leading-relaxed text-pretty"
          value={p.summary}
          placeholder="2-3 sentences about you"
          onSave={(summary) => onSave({ summary })}
        />
      </Section>

      <Section title="Skills">
        <Editable
          label="skills, comma separated"
          value={p.skills.join(", ")}
          placeholder="Comma-separated skills"
          display={<SkillChips skills={p.skills} />}
          onSave={(v) => onSave({ skills: v.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </Section>

      <Section
        title="Projects"
        add={{ label: "Add project", onAdd: () => onSave({ projects: [...p.projects, { name: "New project", description: "" }] }) }}
      >
        <Rows>
          {p.projects.map((x, i) => (
            <Row key={i} name={x.name || "project"} onRemove={() => setProject(i, null)}>
              <Editable label="project name" className="text-[16px] font-semibold" value={x.name} placeholder="Name" onSave={(name) => setProject(i, { name })} />
              <Editable
                label="project description"
                className="text-[15px] leading-snug text-fg/85"
                value={x.description}
                placeholder="What it is"
                onSave={(description) => setProject(i, { description })}
              />
              <Editable
                label="project link"
                className="text-[14px] break-all text-muted"
                value={x.url ?? ""}
                placeholder="Link (optional)"
                onSave={(url) => setProject(i, { url: url || undefined })}
              />
            </Row>
          ))}
        </Rows>
      </Section>

      <Section
        title="Links (QR cards)"
        hint={"These pop up as a scannable QR card when someone asks “got a demo?” Make sure they actually work."}
        add={{ label: "Add link", onAdd: () => onSave({ links: [...p.links, { kind: "other", label: "New link", url: "" }] }) }}
      >
        <Rows>
          {p.links.map((l, i) => (
            <Row key={i} name={l.label || "link"} onRemove={() => setLink(i, null)}>
              <div className="flex items-center gap-3">
                <KindSelect value={l.kind} onChange={(kind) => setLink(i, { kind })} />
                <div className="min-w-0 flex-1">
                  <Editable label="link label" className="text-[16px] font-semibold" value={l.label} placeholder="Label" onSave={(label) => setLink(i, { label })} />
                </div>
              </div>
              <Editable label="link URL" className="text-[14px] break-all text-muted" value={l.url} placeholder="https://…" onSave={(url) => setLink(i, { url })} />
            </Row>
          ))}
        </Rows>
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  add,
  children,
}: {
  title: string;
  hint?: string;
  add?: { label: string; onAdd: () => void };
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>{title}</SectionLabel>
        {add && (
          <button type="button" className="-mr-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-[14px] text-fg" onClick={add.onAdd}>
            <Plus size={16} strokeWidth={1.75} aria-hidden />
            {add.label}
          </button>
        )}
      </div>
      {hint && <p className="text-[14px] leading-snug text-muted text-pretty">{hint}</p>}
      {children}
    </section>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-line border-y border-line">{children}</ul>;
}

function Row({ name, onRemove, children }: { name: string; onRemove: () => void; children: ReactNode }) {
  return (
    <li className="flex gap-2 py-3">
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" aria-label={`Remove ${name}`} className="-mr-2 grid size-11 shrink-0 place-items-center text-muted" onClick={onRemove}>
        <X size={18} strokeWidth={1.75} aria-hidden />
      </button>
    </li>
  );
}

function SkillChips({ skills }: { skills: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {skills.map((s) => (
        <span key={s} className="border border-line px-2.5 py-1 text-[14px]">
          {s}
        </span>
      ))}
    </span>
  );
}

/** Link type is what live mode matches on ("got a demo?" -> the demo link), so it must be right. */
function KindSelect({ value, onChange }: { value: LinkKind; onChange: (k: LinkKind) => void }) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label="Link type"
        className="min-h-11 appearance-none border border-line bg-bg pr-9 pl-3 text-[14px] text-fg focus:border-fg focus:outline-none"
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
