// Chunk 3 · Resume PDF + one free-text box (links, hobbies, anything) -> profile build job.
import { api } from "@larp/shared";
import { useState } from "react";
import { call } from "../../lib/api";
import { readPdf } from "./readPdf";

export function BuildForm({ onStarted, cta }: { onStarted: () => void; cta: string }) {
  const [resume, setResume] = useState<{ name: string; text: string }>();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string>();

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setStatus("Reading your resume…");
    try {
      setResume({ name: file.name, text: await readPdf(file) });
      setStatus(undefined);
    } catch (e) {
      console.error("[profile] pdf parse", String(e));
      setStatus("Couldn't read that PDF. Paste the important bits below instead.");
    }
  };

  const submit = async () => {
    await call(api.buildProfile, { body: { resumeText: resume?.text, notes: notes.trim() || undefined } });
    onStarted();
  };

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-white/20 bg-surface p-4">
        <span className="text-2xl">📄</span>
        <span className="flex-1 text-sm">{resume ? resume.name : "Upload your resume (PDF)"}</span>
        {resume && <span className="text-accent">✓</span>}
        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
      </label>
      {status && <p className="text-sm text-muted">{status}</p>}
      <textarea
        className="h-32 w-full rounded-lg bg-surface p-3 text-sm"
        placeholder={"Links + anything else about you\n\ngithub.com/you · linkedin.com/in/you · your demo\n\"I play tennis and I'm building a voice AI app\""}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button
        className="w-full rounded-lg bg-accent p-3 font-semibold text-bg disabled:opacity-40"
        onClick={submit}
        disabled={!resume && !notes.trim()}
      >
        {cta}
      </button>
    </div>
  );
}
