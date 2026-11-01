// Demo speed: scraping, search, and LLM results are saved to disk so re-running prep on the
// same event or person is instant and free. Delete server/.cache to force fresh results.
// server/demo-cache is committed (scripts/bake-demo-cache.sh) so pre-baked demo results
// also reach Render, whose disk is wiped on every deploy.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const DIR = new URL("../../../.cache/prep/", import.meta.url);
const BAKED = new URL("../../../demo-cache/prep/", import.meta.url);

interface Options<T> {
  /** Skip saved results (regenerate); the new result is still saved. */
  fresh?: boolean;
  /** Only save results worth reusing, so empty ones are retried next time. */
  keep?: (value: T) => boolean;
}

/** Failures throw out of make() and are never saved. */
export async function cached<T>(kind: string, key: unknown, make: () => Promise<T>, opts: Options<T> = {}): Promise<T> {
  const name = `${kind}-${createHash("sha1").update(JSON.stringify(key)).digest("hex").slice(0, 16)}.json`;
  if (!opts.fresh) {
    for (const dir of [BAKED, DIR]) {
      const hit = await readFile(new URL(name, dir), "utf8").catch(() => null);
      if (hit) return JSON.parse(hit) as T;
    }
  }
  const value = await make();
  if (opts.keep?.(value) ?? true) {
    await mkdir(DIR, { recursive: true });
    await writeFile(new URL(name, DIR), JSON.stringify(value));
  }
  return value;
}
