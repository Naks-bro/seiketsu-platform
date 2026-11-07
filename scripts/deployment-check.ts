import { productionConfigErrors } from "../packages/core/src/runtime-config.ts";

const errors = productionConfigErrors(process.env);
for (const name of ["LEGAL_BUSINESS_NAME", "SUPPORT_EMAIL"]) {
  if (!process.env[name]?.trim()) errors.push(`${name} must be set before launch.`);
}
if (process.env.SUPPORT_EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.SUPPORT_EMAIL)) errors.push("SUPPORT_EMAIL must be a valid email address.");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Production environment configuration is valid. No secret values were printed.");
  if (!process.env.RAZORPAY_KEY_ID) console.log("Online payments are disabled until all three Razorpay variables are configured.");
  if (process.argv.includes("--database")) {
    const { openDb } = await import("../packages/db/src/client.ts");
    const { sql } = await import("drizzle-orm");
    const conn = await openDb(process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL!);
    try {
      await conn.db.execute(sql`select loyalty_points_earned, rewards_released_at, last_reconciled_at, issuer_snapshot from public.orders limit 0`);
      const rows = await conn.db.execute(sql`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('orders', 'customers', 'staff_users', 'payments', 'refunds', 'loyalty_ledger') and c.relrowsecurity`);
      if (rows.length !== 6) throw new Error("Required application tables are missing RLS. Apply migrations before deploying.");
      const [{ usable }] = await conn.db.execute<{ usable: boolean }>(sql`select (rolsuper or rolbypassrls or (select pg_get_userbyid(relowner) = current_user from pg_class where oid = 'public.orders'::regclass)) as usable from pg_roles where rolname = current_user`);
      if (!usable) throw new Error("The SQL runtime role must own application tables or have BYPASSRLS. Browser roles have no access.");
      console.log("Database migration columns, RLS flags and server role verified using read-only queries.");
    } finally { await conn.close(); }
  }
}
