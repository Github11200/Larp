// Chunk 5 · Who you met, what you promised, drafts ready to send.
import { api } from "@larp/shared";
import { call } from "../../lib/api";
import { useApi } from "../../lib/useApi";

export function FollowUpsPage() {
  const followUps = useApi(api.listFollowUps);

  const weekLater = async () => {
    await call(api.runNudges);
    void followUps.reload();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Follow-ups</h1>
      {followUps.data?.length === 0 && <p className="text-muted">Talk to someone first.</p>}
      <ul className="space-y-3">
        {followUps.data?.map((f) => (
          <li key={f.id} className={`rounded-lg bg-surface p-3 ${f.status === "nudged" ? "ring-2 ring-accent" : ""}`}>
            <div className="font-semibold">{f.personName}</div>
            {f.promises.map((p) => (
              <div key={p} className="text-sm text-accent">
                You promised: {p}
              </div>
            ))}
            <p className="mt-2 text-sm text-muted">{f.draft}</p>
          </li>
        ))}
      </ul>
      <button className="w-full p-2 text-sm text-muted underline" onClick={weekLater}>
        Skip to a week later
      </button>
    </div>
  );
}
