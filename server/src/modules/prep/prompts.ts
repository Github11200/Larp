// Rules every prep prompt shares. Jokes about people land on what they do, never who they are.
export const RESPECT =
  "Never guess gender, ethnicity, nationality, or age from a name or photo; refer to people by name or 'they'. " +
  "Joke about what people do or post, never about their name or identity. " +
  "Playful hype, never mean: these people may read this, so no digs at their jobs, skills, or bios.";

// Models still slip into he/she for strangers; these lines are shown about real people, so force "they".
const SWAPS: Record<string, string> = {
  "he's": "they're", "she's": "they're", "he'll": "they'll", "she'll": "they'll",
  he: "they", she: "they", him: "them", his: "their", her: "their", hers: "theirs",
  himself: "themself", herself: "themself",
};

export const neutral = (text: string) =>
  text.replace(/\b(he's|she's|he'll|she'll|himself|herself|hers|he|she|him|his|her)\b/gi, (w) => {
    const swap = SWAPS[w.toLowerCase()];
    return w[0] === w[0].toUpperCase() ? swap[0].toUpperCase() + swap.slice(1) : swap;
  });
