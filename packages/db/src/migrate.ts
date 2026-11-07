import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./client.ts";

export const migrationsFolder = join(fileURLToPath(new URL(".", import.meta.url)), "..", "drizzle");

export async function runMigrations(conn: Awaited<ReturnType<typeof openDb>>) {
  if (conn.kind === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(conn.db as never, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(conn.db, { migrationsFolder });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const conn = await openDb(process.env.DATABASE_MIGRATION_URL?.trim() || process.env.DATABASE_URL?.trim() || "pglite:./.data/pglite");
  await runMigrations(conn);
  console.log(`Migrations applied (${conn.kind}).`);
  await conn.close();
}
