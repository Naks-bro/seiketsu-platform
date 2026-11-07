/**
 * One-off move of the live data from the old database to a new, empty one (Neon → Supabase).
 *
 *   SOURCE_DATABASE_URL     the old database (read only)
 *   DATABASE_MIGRATION_URL  the new database (session pooler or direct connection)
 *
 * Builds the schema on the target with the checked-in migrations, copies every table's rows in foreign-key order
 * (only columns both sides have; new columns take their defaults), moves the counters on, then repeats the one
 * data step of 0010 that touches existing orders. Refuses to run on a target that already has data. Prints table
 * names and row counts only, never values or credentials.
 */
import { sql, type SQL } from "drizzle-orm";
import { openDb } from "../packages/db/src/client.ts";
import { runMigrations } from "../packages/db/src/migrate.ts";

type Conn = Awaited<ReturnType<typeof openDb>>;
type Row = Record<string, unknown>;

async function q<T = Row>(c: Conn, s: SQL): Promise<T[]> {
  const r = (await c.db.execute(s)) as unknown as T[] | { rows: T[] };
  return Array.isArray(r) ? r : r.rows;
}

async function tables(c: Conn) {
  return (await q<{ t: string }>(c, sql`select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`)).map((r) => r.t);
}

async function columns(c: Conn, table: string) {
  return q<{ name: string; type: string; udt: string }>(
    c,
    sql`select column_name as name, data_type as type, udt_name as udt from information_schema.columns where table_schema = 'public' and table_name = ${table} order by ordinal_position`,
  );
}

/** Parents before children, from the target's foreign keys. */
async function fkOrder(c: Conn, names: string[]) {
  const edges = await q<{ child: string; parent: string }>(
    c,
    sql`select tc.relname as child, tp.relname as parent from pg_constraint k
        join pg_class tc on tc.oid = k.conrelid join pg_class tp on tp.oid = k.confrelid
        join pg_namespace n on n.oid = tc.relnamespace
        where k.contype = 'f' and n.nspname = 'public'`,
  );
  const deps = new Map(names.map((t) => [t, new Set<string>()]));
  for (const e of edges) if (e.child !== e.parent && deps.has(e.child) && deps.has(e.parent)) deps.get(e.child)!.add(e.parent);
  const out: string[] = [];
  while (deps.size) {
    const ready = [...deps].filter(([, d]) => [...d].every((p) => out.includes(p))).map(([t]) => t).sort();
    if (!ready.length) throw new Error(`Circular foreign keys between: ${[...deps.keys()].join(", ")}`);
    for (const t of ready) {
      out.push(t);
      deps.delete(t);
    }
  }
  return out;
}

function value(v: unknown, col: { type: string; udt: string }): SQL {
  if (v === null || v === undefined) return sql`null`;
  if (col.type === "jsonb" || col.type === "json") return sql`${JSON.stringify(v)}::jsonb`;
  if (col.type === "USER-DEFINED") return sql`${String(v)}::${sql.raw(`"${col.udt}"`)}`;
  if (col.type === "ARRAY") {
    // An array literal such as {"400061","400053"}, cast to the column's element type (udt "_text" → text[]).
    const items = (v as unknown[]).map((x) => (x === null ? "NULL" : `"${String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`));
    return sql`${`{${items.join(",")}}`}::${sql.raw(`"${col.udt.replace(/^_/, "")}"[]`)}`;
  }
  return sql`${v as never}`;
}

async function main() {
  const from = process.env.SOURCE_DATABASE_URL?.trim();
  const to = process.env.DATABASE_MIGRATION_URL?.trim();
  if (!from || !to) throw new Error("Set SOURCE_DATABASE_URL (old) and DATABASE_MIGRATION_URL (new).");
  if (from === to) throw new Error("Source and target are the same database.");

  const src = await openDb(from);
  const dst = await openDb(to);
  try {
    console.log("Building the schema on the new database…");
    await runMigrations(dst);
    const [{ n }] = await q<{ n: number }>(dst, sql`select count(*)::int as n from outlets`);
    if (n > 0) throw new Error("The new database already has data. Nothing was copied.");

    const srcTables = new Set(await tables(src));
    const order = (await fkOrder(dst, await tables(dst))).filter((t) => srcTables.has(t));
    const report: [string, number, number][] = [];

    for (const t of order) {
      const [sCols, dCols] = await Promise.all([columns(src, t), columns(dst, t)]);
      const shared = dCols.filter((d) => sCols.some((s) => s.name === d.name));
      const data = await q(src, sql`select * from ${sql.identifier(t)}`);
      for (let i = 0; i < data.length; i += 200) {
        const batch = data.slice(i, i + 200);
        const cols = sql.join(shared.map((c) => sql.identifier(c.name)), sql`, `);
        const values = sql.join(batch.map((r) => sql`(${sql.join(shared.map((c) => value(r[c.name], c)), sql`, `)})`), sql`, `);
        await dst.db.execute(sql`insert into ${sql.identifier(t)} (${cols}) values ${values}`);
      }
      const [{ n: copied }] = await q<{ n: number }>(dst, sql`select count(*)::int as n from ${sql.identifier(t)}`);
      report.push([t, data.length, copied]);
    }

    // Counters: serial ids carry on after the copied rows; order numbers carry on from the old database.
    const serials = await q<{ t: string; c: string }>(
      dst,
      sql`select table_name as t, column_name as c from information_schema.columns
          where table_schema = 'public' and column_default like 'nextval(%' and column_name = 'id'`,
    );
    for (const { t, c } of serials) {
      await dst.db.execute(sql`select setval(pg_get_serial_sequence(${`public.${t}`}, ${c}), greatest(coalesce((select max(${sql.identifier(c)}) from ${sql.identifier(t)}), 0), 1))`);
    }
    const [seq] = await q<{ last_value: string; is_called: boolean }>(src, sql`select last_value, is_called from order_number_seq`);
    if (seq) await dst.db.execute(sql`select setval('order_number_seq', ${Number(seq.last_value)}, ${seq.is_called})`);

    // The one step of 0010 that changes existing rows: retire old unpaid discounted quotes.
    await dst.db.execute(sql`
      with retired as (
        update orders set status = 'expired', rewards_released_at = now()
        where payment_state = 'unpaid' and discount_paise > 0 and status in ('pending_payment', 'payment_failed', 'expired') and rewards_released_at is null
        returning id
      )
      insert into order_events (order_id, from_status, to_status, actor_type, note)
      select id, null, 'expired', 'system', 'Discount quote retired during reservation upgrade; place a new order. Late payment will be refunded.' from retired`);

    const width = Math.max(...report.map(([t]) => t.length));
    console.log(`\n${"Table".padEnd(width)}   old  new`);
    for (const [t, a, b] of report) console.log(`${t.padEnd(width)} ${String(a).padStart(5)} ${String(b).padStart(4)}${a === b ? "" : "  <- MISMATCH"}`);
    const bad = report.filter(([, a, b]) => a !== b);
    console.log(bad.length ? `\n${bad.length} table(s) do not match.` : `\nAll ${report.length} tables copied. Order numbers continue from ${seq?.last_value ?? "the start"}.`);
    if (bad.length) process.exitCode = 1;
  } finally {
    await Promise.all([src.close(), dst.close()]);
  }
}

// Print only the reason: database errors can carry the row values being copied.
await main().catch((e: Error & { cause?: Error }) => {
  console.error(`Move stopped: ${(e.cause?.message ?? e.message).split("\n")[0].replace(/params:.*$/, "")}`);
  process.exitCode = 1;
});
