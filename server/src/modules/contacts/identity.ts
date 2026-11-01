// Is this the same human? LinkedIn URL is the strongest signal, full name the fallback.

type Who = { name: string; links: string[] };

export const normName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** "https://www.LinkedIn.com/in/Sam-Chen/?utm=x" -> "sam-chen". */
export function linkedinKey(links: string[]): string | undefined {
  for (const l of links) {
    const handle = l.toLowerCase().match(/linkedin\.com\/in\/([^/?#\s]+)/)?.[1];
    if (handle) return decodeURIComponent(handle);
  }
}

/** Two different LinkedIns never merge, even with the same name. */
export function sameHuman(a: Who, b: Who): boolean {
  const la = linkedinKey(a.links);
  const lb = linkedinKey(b.links);
  if (la && lb) return la === lb;
  return normName(a.name) === normName(b.name);
}

/** Exact LinkedIn match first, so a name twin without a LinkedIn doesn't steal it. */
export function findHuman<T extends Who>(pool: T[], who: Who): T | undefined {
  const li = linkedinKey(who.links);
  return (li && pool.find((p) => linkedinKey(p.links) === li)) || pool.find((p) => sameHuman(p, who));
}
