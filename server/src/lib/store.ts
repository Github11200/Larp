// Document store: every record is a JSON doc keyed by (user, collection, id).
// Zod schemas in @larp/shared are the schema, so there are no migrations to coordinate between chunks.
// Postgres when DATABASE_URL is set (Render), in-memory otherwise (local dev, tests).
import postgres from "postgres";
import { z } from "zod";
import { env } from "../env";

interface DocStore {
  get(userId: string, coll: string, id: string): Promise<unknown | null>;
  put(userId: string, coll: string, id: string, data: unknown): Promise<void>;
  list(userId: string, coll: string): Promise<unknown[]>;
  remove(userId: string, coll: string, id: string): Promise<void>;
  /** Across all users. For cron-style jobs only. */
  scan(coll: string): Promise<{ userId: string; data: unknown }[]>;
}

function memoryStore(): DocStore {
  const docs = new Map<string, { userId: string; coll: string; data: unknown }>();
  const key = (u: string, c: string, i: string) => `${u}\u0000${c}\u0000${i}`;
  return {
    async get(u, c, i) {
      return structuredClone(docs.get(key(u, c, i))?.data ?? null);
    },
    async put(u, c, i, data) {
      docs.set(key(u, c, i), { userId: u, coll: c, data: structuredClone(data) });
    },
    async list(u, c) {
      return [...docs.values()].filter((d) => d.userId === u && d.coll === c).map((d) => structuredClone(d.data));
    },
    async remove(u, c, i) {
      docs.delete(key(u, c, i));
    },
    async scan(c) {
      return [...docs.values()].filter((d) => d.coll === c).map((d) => ({ userId: d.userId, data: structuredClone(d.data) }));
    },
  };
}

function postgresStore(url: string): DocStore {
  const sql = postgres(url, { ssl: "prefer", max: 5 }); // Render internal URLs may skip TLS; external ones need it
  const ready = sql`
    create table if not exists docs (
      user_id text not null,
      coll text not null,
      id text not null,
      data jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, coll, id)
    )`;
  return {
    async get(u, c, i) {
      await ready;
      const [row] = await sql`select data from docs where user_id = ${u} and coll = ${c} and id = ${i}`;
      return row?.data ?? null;
    },
    async put(u, c, i, data) {
      await ready;
      await sql`
        insert into docs (user_id, coll, id, data) values (${u}, ${c}, ${i}, ${sql.json(data as never)})
        on conflict (user_id, coll, id) do update set data = excluded.data, updated_at = now()`;
    },
    async list(u, c) {
      await ready;
      const rows = await sql`select data from docs where user_id = ${u} and coll = ${c} order by updated_at`;
      return rows.map((r) => r.data);
    },
    async remove(u, c, i) {
      await ready;
      await sql`delete from docs where user_id = ${u} and coll = ${c} and id = ${i}`;
    },
    async scan(c) {
      await ready;
      const rows = await sql`select user_id, data from docs where coll = ${c}`;
      return rows.map((r) => ({ userId: r.user_id as string, data: r.data }));
    },
  };
}

const store: DocStore = env.databaseUrl ? postgresStore(env.databaseUrl) : memoryStore();

/** A typed, validated view over one collection. */
export function collection<S extends z.ZodType<{ id: string }>>(name: string, schema: S) {
  type T = z.output<S>;
  return {
    async get(userId: string, id: string): Promise<T | null> {
      const raw = await store.get(userId, name, id);
      return raw == null ? null : schema.parse(raw);
    },
    async require(userId: string, id: string): Promise<T> {
      const doc = await this.get(userId, id);
      if (!doc) throw new NotFound(`${name}/${id}`);
      return doc;
    },
    async put(userId: string, doc: z.input<S>): Promise<T> {
      const parsed = schema.parse(doc);
      await store.put(userId, name, parsed.id, parsed);
      return parsed;
    },
    /** Read-modify-write. Last write wins; fine at hackathon scale. */
    async update(userId: string, id: string, patch: (doc: T) => T | void): Promise<T> {
      const doc = await this.require(userId, id);
      return this.put(userId, (patch(doc) ?? doc) as z.input<S>);
    },
    async list(userId: string): Promise<T[]> {
      return (await store.list(userId, name)).map((d) => schema.parse(d));
    },
    async remove(userId: string, id: string): Promise<void> {
      await store.remove(userId, name, id);
    },
    async scan(): Promise<{ userId: string; doc: T }[]> {
      return (await store.scan(name)).map((r) => ({ userId: r.userId, doc: schema.parse(r.data) }));
    },
  };
}

export class NotFound extends Error {}
