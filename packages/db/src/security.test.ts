import { expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { openDb } from "./client";
import { runMigrations } from "./migrate";

it("migrates safely twice and denies browser roles direct access to protected tables", async () => {
  const conn = await openDb("pglite:memory");
  try {
    await conn.db.execute(sql`create role anon`);
    await conn.db.execute(sql`create role authenticated`);
    await runMigrations(conn);
    await runMigrations(conn);
    // Even accidental later SELECT grants must not expose rows: RLS has no browser policy.
    await conn.db.execute(sql`grant select on public.customers to anon`);
    await conn.db.execute(sql`insert into public.customers (phone, name) values ('9899999999', 'Private customer')`);
    await conn.db.transaction(async (tx) => {
      await tx.execute(sql`set local role anon`);
      const result = await tx.execute(sql`select * from public.customers`);
      const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows;
      expect(rows).toEqual([]);
    });
    await expect(conn.db.transaction(async (tx) => {
      await tx.execute(sql`set local role authenticated`);
      await tx.execute(sql`select * from public.staff_users`);
    })).rejects.toThrow();
  } finally { await conn.close(); }
});
