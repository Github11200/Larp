// Tap-to-edit text. Saves on blur or Enter, Escape cancels.
import { Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";
import { fieldClass } from "../../components/ui";

export function Editable({
  value,
  onSave,
  placeholder,
  label,
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
  /** Typography when reading. */
  className?: string;
  /** Extra classes on the edit field (it uses the standard field look). */
  editClassName?: string;
  multiline?: boolean;
  /** Custom read view (e.g. skill chips); falls back to the plain value. */
  display?: ReactNode;
}) {
  const [draft, setDraft] = useState<string>();

  if (draft === undefined) {
    return (
      <button
        type="button"
        aria-label={`Edit ${label}: ${value || "empty"}`}
        className={`group flex min-h-11 w-full gap-3 py-1.5 text-left ${multiline ? "items-start" : "items-center"}`}
        onClick={() => setDraft(value)}
      >
        <span className={`min-w-0 flex-1 ${className} ${value ? "" : "text-muted"}`}>{value ? (display ?? value) : placeholder}</span>
        {/* Quiet hint that every field is tappable; brightens on hover/focus. */}
        <Pencil
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className={`shrink-0 text-muted ${multiline ? "mt-1" : ""} opacity-50 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100`}
        />
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
