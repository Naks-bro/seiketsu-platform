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
import { assertProductionConfig, databaseUrlFrom, servingDatabaseUrl } from "@seiketsu/core/runtime-config";

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


/** PEM text. Pasted multi-line works as-is; a single line with literal "\n" sequences is turned back into lines. */
const sslCa = () => process.env.DATABASE_SSL_CA?.trim().replaceAll("\\n", "\n") || undefined;

async function connect(url: string): Promise<Conn> {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const { default: postgres } = await import("postgres");
    // prepare:false works with Supabase transaction pooler (port 6543).
    const sql = postgres(url, {
      prepare: false,
      // A few per instance: a request can hold one in a transaction while reading with another.
      max: Number(process.env.DB_POOL_MAX ?? 3),
      idle_timeout: 20,
      connect_timeout: 10,
      // Certificates are always verified in production. Supabase signs them with its own CA: put that PEM (Project
      // Settings > Database > SSL certificate) in DATABASE_SSL_CA so verification can succeed.
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true, ...(sslCa() ? { ca: sslCa() } : {}) } : undefined,
    });
    return { db: drizzlePg(sql, { schema }), close: () => sql.end({ timeout: 5 }), kind: "postgres" };
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

const g = globalThis as unknown as { __seiketsuDb?: Promise<Conn>; __seiketsuDbUsed?: number };

/**
 * Serverless instances are frozen between requests. Sockets that were open when an instance froze are often dead
 * when it wakes, and a query sent on one waits for the OS to give up (minutes), not for Postgres. So after a quiet
 * spell a Postgres pool is replaced before use; connecting again costs a few tens of milliseconds. The old pool
 * gets 5 seconds to finish anything still running on it.
 */
const STALE_AFTER_MS = 15_000;

/** Shared connection for the app (kept across hot reloads). */
export function getConn(): Promise<Conn> {
  if (process.env.NODE_ENV === "production") assertProductionConfig(process.env);
  const url = servingDatabaseUrl(databaseUrlFrom(process.env)) || "pglite:./.data/pglite";
  const now = Date.now();
  const old = g.__seiketsuDb;
  if (old && /^postgres(ql)?:\/\//.test(url) && now - (g.__seiketsuDbUsed ?? now) > STALE_AFTER_MS) {
    g.__seiketsuDb = undefined;
    void old.then((c) => c.close()).catch(() => {});
  }
  g.__seiketsuDbUsed = now;
  g.__seiketsuDb ??= connect(url);
  return g.__seiketsuDb;
}

export async function getDb(): Promise<Db> {
  return (await getConn()).db;
}

/** Fresh connection for scripts and tests. */
export function openDb(url: string): Promise<Conn> {
  return connect(url);
}
