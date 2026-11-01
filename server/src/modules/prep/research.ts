// Real facts about a person from the web (Exa search), so dossiers aren't made up.
import type { Person } from "@larp/shared";
import { env } from "../../env";
import { cached } from "./cache";

interface ExaResult {
  title?: string;
  url: string;
  text?: string;
}

/** Search-result text about the person, or "" when Exa isn't configured or finds nothing. */
export async function researchPerson(person: Person): Promise<string> {
  if (!env.exaKey) return "";
  const query = [person.name, person.headline?.replace(/^Host · /, "")].filter(Boolean).join(", ");
  const results = await cached("exa", query, async () => {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "x-api-key": env.exaKey!, "content-type": "application/json" },
      body: JSON.stringify({ query, numResults: 5, type: "auto", contents: { text: { maxCharacters: 1500 } } }),
    });
    if (!res.ok) throw new Error(`Exa ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return ((await res.json()) as { results: ExaResult[] }).results;
  });
  return results.map((r) => `### ${r.title ?? r.url}\n${r.url}\n${r.text ?? ""}`).join("\n\n");
}
