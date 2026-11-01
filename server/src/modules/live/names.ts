// Chunk 1 · Catches names said out loud ("I'm Mati", "this is my friend Sara", "hey Priya")
// and matches them to the event's attendees, so a stranger turns into a dossier mid-chat.
// Pure and sync: runs on every finished line.
import type { Person } from "@larp/shared";

// A cue phrase, then the name is captured by lookahead (not consumed) so "hi, I'm Sam" still sees "I'm Sam".
const CUE =
  /\b(?:i'?m|i am|my name is|my name's|name's|call me|this is|meet|say hi to|hey|hi|hello|yo|thanks|thank you|nice to meet you|good to meet you|great to meet you)\s*,?\s+(?:my\s+(?:friend|cofounder|co-founder|colleague|coworker|teammate|boss|partner|roommate|manager)\s*,?\s+)?(?=([a-z][a-z'-]*))/gi;
const LAST_NAME = /^\s+([A-Z][a-z]+)\b/;

/** Words that follow a cue but aren't names ("I'm good", "hey everyone", "this is great"). */
const NOT_NAMES = new Set(
  (
    "a an the so just not good great fine okay ok sorry here there back new really very also still from with working building " +
    "doing trying going looking actually kind sort pretty super totally definitely glad happy excited curious interested sure " +
    "everyone everybody guys all you yourself again man dude bro there's that this it what how who why where when i i'm im " +
    "me my our your his her their we they he she um uh like basically honestly literally gonna wanna lot amazing awesome " +
    "cool nice wild insane crazy tired done in on at to for of and or but if is was are be been engineer founder student " +
    "monday tuesday wednesday thursday friday saturday sunday tonight today tomorrow"
  ).split(" "),
);

export interface CaughtName {
  /** As said, e.g. "Sara" or "Sara Kim". */
  name: string;
  /** The attendee it matched, if any. */
  person?: Person;
}

/**
 * Names introduced in a line, matched against attendees. A lowercase word only counts if it matches
 * an attendee (typed lines are often lowercase); otherwise it must look like a name (Capitalized).
 * `ignore` is the user's own name and project names, so "I'm Nonit" or "this is Larp" add nobody.
 */
export function catchNames(text: string, attendees: Person[], ignore: string[] = []): CaughtName[] {
  const skip = new Set([...NOT_NAMES, ...ignore.flatMap((s) => norm(s).split(" "))]);
  const line = text.replace(/[\u2018\u2019]/g, "'");
  const out: CaughtName[] = [];
  for (const m of line.matchAll(CUE)) {
    const first = m[1];
    if (first.length < 2 || skip.has(first.toLowerCase())) continue;
    const after = line.slice(m.index + m[0].length + first.length);
    const last = LAST_NAME.exec(after)?.[1];
    const full = last && !skip.has(last.toLowerCase()) ? `${first} ${last}` : first;
    const person = matchAttendee(full, attendees);
    if (person) out.push({ name: person.name, person });
    else if (/^[A-Z][a-z]/.test(first)) out.push({ name: full });
  }
  return dedupe(out);
}

/** Fuzzy first-name (or full-name) match: "Mati" -> "Matías Gómez", "Pria" -> "Priya Patel". */
export function matchAttendee(said: string, attendees: Person[]): Person | undefined {
  const [first, last] = norm(said).split(" ");
  const hits = attendees.filter((p) => sameName(first, firstOf(p.name)));
  if (hits.length <= 1 || !last) return hits[0];
  return hits.find((p) => norm(p.name).split(" ").slice(1).some((w) => w.startsWith(last))) ?? hits[0];
}

function sameName(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 3 && long.startsWith(short)) return true; // nicknames: Sam/Samantha, Mati/Matias
  return short.length >= 4 && editDistance(x, y) <= 1; // STT spelling: Pria/Priya
}

const firstOf = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim();

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function dedupe(names: CaughtName[]): CaughtName[] {
  const seen = new Set<string>();
  return names.filter((n) => {
    const key = n.person?.id ?? norm(n.name);
    return !seen.has(key) && seen.add(key);
  });
}
