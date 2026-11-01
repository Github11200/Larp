// Text that reads plain, and becomes tap-to-edit while the profile is in Edit mode. Saves on blur or Enter, Escape cancels.
import { Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";
import { fieldClass } from "../../components/ui";

export function Editable({
  value,
  onSave,
  placeholder,
  label,
  editing,
  className = "",
  editClassName = "",
  multiline = false,
  display,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
  /** Spoken name of the field ("Edit headline"). */
  label: string;
  /** Edit mode: fields are tappable. Otherwise they just read (empty ones vanish). */
  editing: boolean;
  /** Typography when reading. */
  className?: string;
  /** Extra classes on the edit field (it uses the standard field look). */
  editClassName?: string;
  multiline?: boolean;
  /** Custom read view (e.g. skill chips); falls back to the plain value. */
  display?: ReactNode;
}) {
  const [draft, setDraft] = useState<string>();

  if (!editing) return value ? <span className={`block ${className}`}>{display ?? value}</span> : null;

  if (draft === undefined) {
    return (
      <button
        type="button"
        aria-label={`Edit ${label}: ${value || "empty"}`}
        className={`flex min-h-11 w-full gap-3 py-1.5 text-left ${multiline ? "items-start" : "items-center"}`}
        onClick={() => setDraft(value)}
      >
        <span className={`min-w-0 flex-1 ${className} ${value ? "" : "text-muted"}`}>{value ? (display ?? value) : placeholder}</span>
        <Pencil size={14} strokeWidth={1.75} aria-hidden className={`shrink-0 text-muted ${multiline ? "mt-1" : ""}`} />
      </button>
    );
  }

  const commit = () => {
    if (draft.trim() !== value) onSave(draft.trim());
    setDraft(undefined);
  };
  const props = {
    autoFocus: true,
    value: draft,
    placeholder,
    "aria-label": label,
    className: `${fieldClass} my-0.5 ${editClassName}`,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !(multiline && e.shiftKey)) (e.target as HTMLElement).blur();
      if (e.key === "Escape") setDraft(undefined);
    },
  };
  return multiline ? <textarea rows={4} {...props} /> : <input {...props} />;
}
