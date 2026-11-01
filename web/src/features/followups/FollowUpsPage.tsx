// Chunk 5 · Who you met, what you promised, drafts ready to send.
import { api, type FollowUp } from "@larp/shared";
import { BellRing, Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink, firstName, Pending, SectionLabel, Title } from "../../components/ui";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { paths } from "../../routes";

export function FollowUpsPage() {
  const followUps = useApi(api.listFollowUps);
  const list = followUps.data ?? [];

  const weekLater = async () => {
    await call(api.runNudges);
    void followUps.reload();
  };

  return (
    <div className="space-y-8">
      <Title sub="Who you met, what you promised, and the message to send. You just hit send.">Follow-ups</Title>
      {followUps.loading && <Pending>Remembering who you met…</Pending>}
      {!followUps.loading && list.length === 0 && (
        <div className="space-y-4 border border-dashed border-line p-5">
          <p className="text-[16px] text-pretty">Nobody yet. Talk to someone and the follow-ups write themselves.</p>
          <ButtonLink to={paths.live()} variant="secondary">
            Go live
          </ButtonLink>
        </div>
      )}
      <ul className="space-y-10">
        {list.map((f) => (
          <li key={f.id}>
            <FollowUpItem followUp={f} />
          </li>
        ))}
      </ul>
      {list.length > 0 && (
        <Button variant="ghost" className="w-full" onClick={weekLater}>
          Skip to a week later
        </Button>
      )}
    </div>
  );
}

function FollowUpItem({ followUp: f }: { followUp: FollowUp }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(f.draft);
    setCopied(true);
  };

  return (
    <article className="space-y-4">
      {f.status === "nudged" && (
        <p className="flex items-center gap-2 text-[14px] font-semibold text-live">
          <BellRing size={16} strokeWidth={2} aria-hidden />
          It's been a week. Don't ghost {firstName(f.personName)}.
        </p>
      )}
      <h2 className="font-serif text-[1.9rem] leading-[1.05]">{f.personName}</h2>
      {f.summary && <p className="text-[15px] leading-relaxed text-muted text-pretty">{f.summary}</p>}
      {f.promises.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>You promised</SectionLabel>
          <ul className="space-y-1.5">
            {f.promises.map((p) => (
              <li key={p} className="text-[16px]">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-3 border border-line bg-surface p-4">
        <p className="text-[15px] leading-relaxed whitespace-pre-line">{f.draft}</p>
        <Button variant="secondary" className="w-full" onClick={copy}>
          {copied ? <Check size={18} aria-hidden /> : <Copy size={18} strokeWidth={1.75} aria-hidden />}
          {copied ? "Copied. Go send it" : "Copy message"}
        </Button>
      </div>
    </article>
  );
}
