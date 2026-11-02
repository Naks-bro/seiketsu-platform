/**
 * Database connection.
 * - DATABASE_URL=postgres://...  → real Postgres (Supabase in production)
 * - DATABASE_URL=pglite:./.data/pglite (or unset) → embedded Postgres for local dev
 * - DATABASE_URL=pglite:memory → throwaway in-memory database for tests
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema.ts";

export type Db = PostgresJsDatabase<typeof schema>;

/** Walk up to the monorepo root so relative pglite paths work from any workspace. */
export function repoRoot(start = process.cwd()): string {
  let dir = start;
  for (;;) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg) && JSON.parse(readFileSync(pkg, "utf8")).workspaces) return dir;
    const up = dirname(dir);
    if (up === dir) return start;
    dir = up;
  }
}

type Conn = { db: Db; close: () => Promise<void>; kind: "postgres" | "pglite" };

async function connect(url: string): Promise<Conn> {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const { default: postgres } = await import("postgres");
    // prepare:false works with Supabase transaction pooler (port 6543).
    const sql = postgres(url, { prepare: false, max: Number(process.env.DB_POOL_MAX ?? 5) });
    return { db: drizzlePg(sql, { schema }), close: () => sql.end(), kind: "postgres" };
  }
  const raw = url.replace(/^pglite:/, "") || "./.data/pglite";
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  let client;
  if (raw === "memory") {
    client = await PGlite.create();
  } else {
    const dataDir = isAbsolute(raw) ? raw : resolve(repoRoot(), raw);
    mkdirSync(dirname(dataDir), { recursive: true });
    client = await PGlite.create(dataDir);
  }
  const db = drizzle(client, { schema }) as unknown as Db;
  return { db, close: () => client.close(), kind: "pglite" };
}

const g = globalThis as unknown as { __seiketsuDb?: Promise<Conn> };

/** Shared connection for the app (kept across hot reloads). */
export function getConn(): Promise<Conn> {
  g.__seiketsuDb ??= connect(process.env.DATABASE_URL ?? "pglite:./.data/pglite");
  return g.__seiketsuDb;
}

export async function getDb(): Promise<Db> {
  return (await getConn()).db;
}

/** Fresh connection for scripts and tests. */
export function openDb(url: string): Promise<Conn> {
  return connect(url);
}
