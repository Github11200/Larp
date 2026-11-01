// Chunk 3 · Resume PDF + one free-text box (links, hobbies, anything) -> profile build job.
import { api } from "@larp/shared";
import { useState } from "react";
import { Button, fieldClass, FilePick, Notice, Pending } from "../../components/ui";
import { call } from "../../lib/api";
import { readPdf } from "./readPdf";

export function BuildForm({ onStarted, cta }: { onStarted: () => void; cta: string }) {
  const [resume, setResume] = useState<{ name: string; text: string }>();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"reading" | "failed">();

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setStatus("reading");
    try {
      setResume({ name: file.name, text: await readPdf(file) });
      setStatus(undefined);
    } catch (e) {
      console.error("[profile] pdf parse", String(e));
      setStatus("failed");
    }
  };

  const submit = async () => {
    await call(api.buildProfile, { body: { resumeText: resume?.text, notes: notes.trim() || undefined } });
    onStarted();
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <FilePick label="Upload your resume (PDF)" picked={resume?.name} accept="application/pdf" onPick={(files) => pickFile(files?.[0])} />
        {status === "reading" && <Pending>Reading your resume…</Pending>}
        {status === "failed" && <Notice>Couldn't read that PDF. Paste the important bits below instead.</Notice>}
      </div>
      <label className="block space-y-2">
        <span className="block text-[13px] font-semibold text-muted">Links and anything else about you</span>
        <textarea
          className={`${fieldClass} h-36 resize-none leading-relaxed`}
          placeholder={"github.com/you, linkedin.com/in/you, your demo\n\"I play tennis and I'm building a voice AI app\""}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <Button className="w-full" onClick={submit} disabled={!resume && !notes.trim()}>
        {cta}
      </Button>
    </div>
  );
}
