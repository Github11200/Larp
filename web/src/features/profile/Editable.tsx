// Tap-to-edit text. Saves on blur or Enter, Escape cancels.
import { useState } from "react";

export function Editable({
  value,
  onSave,
  placeholder,
  className = "",
  multiline = false,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
  className?: string;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState<string>();

  if (draft === undefined) {
    return (
      <button type="button" className={`block w-full text-left ${className} ${value ? "" : "text-muted italic"}`} onClick={() => setDraft(value)}>
        {value || placeholder}
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
    className: `w-full rounded bg-surface px-2 py-1 outline outline-accent/60 ${className}`,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !(multiline && e.shiftKey)) (e.target as HTMLElement).blur();
      if (e.key === "Escape") setDraft(undefined);
    },
  };
  return multiline ? <textarea rows={3} {...props} /> : <input {...props} />;
}
