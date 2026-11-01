// Chunk 1 · Catches names said out loud ("I'm Mati", "this is my friend Sara", "hey Priya")
// and matches them to the event's attendees, so a stranger turns into a dossier mid-chat.
// Pure and sync: runs on every finished line.
import type { Person } from "@larp/shared";

// A cue phrase that introduces or greets someone, optionally "my friend", then their name.
const CUE_LEAD =
  "\\b(i'?m|i am|my name is|my name's|name's|call me|this is|meet|say hi to|hey|hi|hello|yo|thanks|thank you|nice to meet you|good to meet you|great to meet you)\\s*,?\\s+(?:my\\s+(?:friend|cofounder|co-founder|colleague|coworker|teammate|boss|partner|roommate|manager)\\s*,?\\s+)?";
// Group 1 is the cue; the name (group 2) is captured by lookahead (not consumed) so "hi, I'm Sam" still sees "I'm Sam".
const CUE = new RegExp(`${CUE_LEAD}(?=([a-z][a-z'-]*))`, "gi");
/** Text ending in a cue, i.e. the next word is probably a name. */
const ENDS_IN_CUE = new RegExp(`${CUE_LEAD}$`, "i");
const LAST_NAME = /^\s+([A-Z][a-z]+)\b/;
/** Bare greetings name whoever's addressed, but also catch noise ("hey Siri", "thanks Google"): attendees only. */
const GREETING_CUE = /^(hey|hi|hello|yo|thanks|thank you)$/i;

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
    const [, cue, first] = m;
    if (first.length < 2 || skip.has(first.toLowerCase())) continue;
    const after = line.slice(m.index + m[0].length + first.length);
    const last = LAST_NAME.exec(after)?.[1];
    const full = last && !skip.has(last.toLowerCase()) ? `${first} ${last}` : first;
    const person = matchAttendee(full, attendees);
    if (person) out.push({ name: person.name, person });
    else if (/^[A-Z][a-z]/.test(first) && !GREETING_CUE.test(cue)) out.push({ name: full });
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

/**
 * Looser than an attendee match: could one first name be a mishearing of the other ("Junaid" for "Jinay")?
 * Same first letter, consonant sounds that start the same and differ by at most one, spelled within 3 letters.
 * Short names (Jim, Sam) are skipped: too many real names sound alike. Used to stop one person becoming two.
 */
export function soundsAlike(a: string, b: string): boolean {
  const [x, y] = [norm(firstOf(a)), norm(firstOf(b))];
  if (sameName(x, y)) return true;
  if (x.length < 4 || y.length < 4 || x[0] !== y[0]) return false;
  const [kx, ky] = [soundKey(x), soundKey(y)];
  const [short, long] = kx.length <= ky.length ? [kx, ky] : [ky, kx];
  return short.length >= 2 && long.length - short.length <= 1 && long.startsWith(short) && editDistance(x, y) <= 3;
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

interface KnownName {
  first: string;
  key: string;
  /** Only when the first name is unique, so "Janae Shaw" -> "Jinay Shah" can't pick the wrong Jinay. */
  last?: string;
}

/**
 * Snaps misheard names to names we know: "I'm No nit" -> "I'm Nonit", "Janae" -> "Jinay".
 * Sync and cheap: runs on every partial. A word only changes when it sounds like a known first name,
 * is spelled within a letter or two of it, and is said like a name: right after a cue ("I'm", "hey",
 * "this is my friend") or Capitalized mid-sentence. A split name ("No nit") needs the cue or both
 * words Capitalized, so "I have no net worth" stays put.
 */
export function nameFixer(known: string[]): (text: string) => string {
  const byFirst = new Map<string, KnownName>();
  for (const full of known) {
    const [first, ...rest] = full.trim().split(/\s+/);
    if (!first || norm(first).length < 3) continue;
    const seen = byFirst.get(norm(first));
    if (seen) seen.last = seen.last === rest.join(" ") ? seen.last : undefined;
    else byFirst.set(norm(first), { first, key: soundKey(norm(first)), last: rest.join(" ") || undefined });
  }
  const names = [...byFirst.values()];
  return names.length ? (text) => fixNames(text, names) : (text) => text;
}

function fixNames(text: string, names: KnownName[]): string {
  const words = [...text.matchAll(/\p{L}+/gu)].map((m) => ({ text: m[0], at: m.index, end: m.index + m[0].length }));
  const edits: { at: number; end: number; to: string }[] = [];
  const heard = new Map<string, KnownName>(); // a mishearing fixed once is fixed again, even where it lacks a cue
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    const cued = ENDS_IN_CUE.test(text.slice(0, w.at));
    const pair = next && /^\s+$/.test(text.slice(w.end, next.at)) ? next : undefined;
    const pairOk = pair && (cued || (isCap(w.text) && isCap(pair.text)));
    const twoWord = pairOk ? closest(w.text + pair.text, names) : undefined;
    const oneWord = cued || (isCap(w.text) && midSentence(text, w.at)) ? closest(w.text, names) : heard.get(w.text);
    const name = twoWord ?? oneWord;
    if (!name || NOT_NAMES.has(w.text.toLowerCase())) continue;
    const used = twoWord ? 2 : 1;
    if (!twoWord) heard.set(w.text, name);
    let end = words[i + used - 1].end;
    let to = name.first;
    const lastWord = words[i + used];
    if (name.last && lastWord && isCap(lastWord.text) && /^\s+$/.test(text.slice(end, lastWord.at))) {
      const last = closest(lastWord.text, [{ first: name.last, key: soundKey(norm(name.last)) }]);
      if (last) [end, to] = [lastWord.end, `${name.first} ${name.last}`];
    }
    edits.push({ at: w.at, end, to });
    i = words.findIndex((x) => x.end === end);
  }
  let out = text;
  for (const e of edits.reverse()) out = out.slice(0, e.at) + e.to + out.slice(e.end);
  return out;
}

/** The known name a word sounds and spells most like; none when two tie (ambiguous). */
function closest(said: string, names: KnownName[]): KnownName | undefined {
  const s = norm(said);
  let best: KnownName | undefined;
  let bestD = Infinity;
  let tie = false;
  for (const n of names) {
    const d = soundsLike(s, n);
    if (d === undefined) continue;
    if (d < bestD) [best, bestD, tie] = [n, d, false];
    else if (d === bestD) tie = true;
  }
  return tie ? undefined : best;
}

/** Edit distance when `said` could be a mishearing of the name: same consonant sounds, at most 1-2 letters off. */
function soundsLike(said: string, name: KnownName): number | undefined {
  const target = norm(name.first);
  if (said === target) return 0;
  if (said.length < 3 || soundKey(said) !== name.key) return undefined;
  const d = editDistance(said, target);
  return d <= (target.length >= 5 ? 2 : 1) ? d : undefined;
}

// Soundex-style consonant classes: letters that STT confuses share a digit; vowels, h, w, y drop out.
const SOUND: Record<string, string> = Object.fromEntries(
  ["bfpv", "cgjkqsxz", "dt", "l", "mn", "r"].flatMap((group, i) => [...group].map((ch) => [ch, String(i + 1)])),
);
function soundKey(s: string): string {
  let key = "";
  let prev = "";
  for (const ch of s) {
    const code = SOUND[ch] ?? "";
    if (code && code !== prev) key += code;
    prev = code;
  }
  return key;
}

const isCap = (w: string) => /^\p{Lu}/u.test(w);
/** Sentence starts are Capitalized anyway, so there a capital says nothing about being a name. */
const midSentence = (text: string, at: number) => !/(^|[.!?]\s*)\W*$/.test(text.slice(0, at));
