// Chunk 3 · Resume PDF + one free-text box (links, hobbies, anything) -> profile build job.
import { api } from "@larp/shared";
import { useState } from "react";
import { Button, Field, fieldClass, FilePick, Notice, Pending } from "../../components/ui";
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
        {status === "failed" && <Notice>Couldn't read that PDF. Paste the good bits below.</Notice>}
      </div>
      <Field label="Links, hobbies, anything">
        <textarea
          className={`${fieldClass} h-36 resize-none leading-relaxed`}
          placeholder={"github.com/you, linkedin.com/in/you\nI play tennis, building a voice AI app"}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <Button className="w-full" onClick={submit} disabled={status === "reading" || (!resume && !notes.trim())}>
        {cta}
      </Button>
    </div>
  );
}
