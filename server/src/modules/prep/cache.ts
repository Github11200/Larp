// Demo speed: scraping, search, and LLM results are saved to disk so re-running prep on the
// same event or person is instant and free. Delete server/.cache to force fresh results.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const DIR = new URL("../../../.cache/prep/", import.meta.url);

export async function cached<T>(kind: string, key: unknown, make: () => Promise<T>): Promise<T> {
  const file = new URL(`${kind}-${createHash("sha1").update(JSON.stringify(key)).digest("hex").slice(0, 16)}.json`, DIR);
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    const value = await make();
    await mkdir(DIR, { recursive: true });
    await writeFile(file, JSON.stringify(value));
    return value;
  }
}
