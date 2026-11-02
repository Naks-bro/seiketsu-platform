import "server-only";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb, orderItems, orders, payments, refunds } from "@seiketsu/db";

const IST_MS = 330 * 60_000;
const PAID = ["paid", "partially_refunded", "refunded"] as const;

export type Range = { key: string; label: string; from: Date; to: Date; fromDay: string; toDay: string };

/** "YYYY-MM-DD" in India for a moment. */
export const istDay = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
/** Midnight in India for an India date. */
const istMidnight = (day: string) => new Date(new Date(`${day}T00:00:00Z`).getTime() - IST_MS);
const addDays = (day: string, n: number) => istDay(new Date(istMidnight(day).getTime() + n * 86_400_000 + IST_MS / 2));

/** Turns ?range=today|7d|30d|month or ?from=&to= into an IST date range (to is exclusive). */
export function parseRange(sp: { range?: string; from?: string; to?: string }, now = new Date()): Range {
  const today = istDay(now);
  const day = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const custom = day(sp.from) && day(sp.to);
  let fromDay: string;
  let toDay: string;
  let key = sp.range ?? "today";
  let label: string;
  if (custom) {
    fromDay = day(sp.from)!;
    toDay = day(sp.to)!;
    if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
    key = "custom";
    label = fromDay === toDay ? fromDay : `${fromDay} to ${toDay}`;
  } else if (key === "7d" || key === "30d") {
    const n = key === "7d" ? 7 : 30;
    fromDay = addDays(today, -(n - 1));
    toDay = today;
    label = `Last ${n} days`;
  } else if (key === "month") {
    fromDay = `${today.slice(0, 8)}01`;
    toDay = today;
    label = "This month";
  } else {
    key = "today";
    fromDay = toDay = today;
    label = "Today";
  }
  return { key, label, from: istMidnight(fromDay), to: istMidnight(addDays(toDay, 1)), fromDay, toDay };
}

export async function salesReport(outletId: string, r: Range) {
  const db = await getDb();
  const inRange = and(eq(orders.outletId, outletId), inArray(orders.paymentState, [...PAID]), gte(orders.placedAt, r.from), lt(orders.placedAt, r.to));
  const money = (col: unknown) => sql<number>`coalesce(sum(${col}), 0)::int`;

  const [totals] = await db
    .select({
      orders: sql<number>`count(*)::int`,
      gross: money(orders.totalPaise),
      tax: money(orders.taxPaise),
      discount: money(orders.discountPaise),
      delivery: money(orders.deliveryFeePaise),
    })
    .from(orders)
    .where(inRange);

  const [refunded] = await db
    .select({ amount: money(refunds.amountPaise) })
    .from(refunds)
    .innerJoin(payments, eq(payments.id, refunds.paymentId))
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(inRange, inArray(refunds.status, ["processed", "created", "pending"])));

  const byPayment = await db
    .select({ provider: payments.provider, orders: sql<number>`count(*)::int`, amount: money(payments.amountPaise), fees: sql<number>`coalesce(sum(${payments.feePaise} + coalesce(${payments.feeTaxPaise}, 0)), 0)::int` })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(inRange, inArray(payments.status, ["captured", "refunded"])))
    .groupBy(payments.provider);

  const bySource = await db
    .select({ source: orders.source, orders: sql<number>`count(*)::int`, amount: money(orders.totalPaise) })
    .from(orders)
    .where(inRange)
    .groupBy(orders.source);

  const bestSellers = await db
    .select({ name: orderItems.itemName, qty: sql<number>`sum(${orderItems.quantity})::int`, amount: money(orderItems.lineTotalPaise) })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(inRange)
    .groupBy(orderItems.itemName)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(15);

  const ist = sql`(${orders.placedAt} at time zone 'Asia/Kolkata')`;
  const byHour = await db
    .select({ hour: sql<number>`extract(hour from ${ist})::int`, orders: sql<number>`count(*)::int`, amount: money(orders.totalPaise) })
    .from(orders)
    .where(inRange)
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const byDay = await db
    .select({ day: sql<string>`to_char(${ist}, 'YYYY-MM-DD')`, orders: sql<number>`count(*)::int`, amount: money(orders.totalPaise) })
    .from(orders)
    .where(inRange)
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const t = { orders: Number(totals?.orders ?? 0), gross: Number(totals?.gross ?? 0), tax: Number(totals?.tax ?? 0), discount: Number(totals?.discount ?? 0), delivery: Number(totals?.delivery ?? 0) };
  const refund = Number(refunded?.amount ?? 0);
  return {
    totals: { ...t, refunds: refund, net: t.gross - refund, average: t.orders ? Math.round(t.gross / t.orders) : 0 },
    byPayment: byPayment.map((p) => ({ ...p, orders: Number(p.orders), amount: Number(p.amount), fees: Number(p.fees) })),
    bySource: bySource.map((s) => ({ ...s, orders: Number(s.orders), amount: Number(s.amount) })),
    bestSellers: bestSellers.map((b) => ({ ...b, qty: Number(b.qty), amount: Number(b.amount) })),
    byHour: byHour.map((h) => ({ hour: Number(h.hour), orders: Number(h.orders), amount: Number(h.amount) })),
    byDay: byDay.map((d) => ({ ...d, orders: Number(d.orders), amount: Number(d.amount) })),
  };
}

/** Every paid order in the range, for the CSV export. */
export async function ordersForExport(outletId: string, r: Range) {
  const db = await getDb();
  return db
    .select({ o: orders, provider: payments.provider })
    .from(orders)
    .leftJoin(payments, and(eq(payments.orderId, orders.id), inArray(payments.status, ["captured", "refunded"])))
    .where(and(eq(orders.outletId, outletId), inArray(orders.paymentState, [...PAID]), gte(orders.placedAt, r.from), lt(orders.placedAt, r.to)))
    .orderBy(orders.placedAt)
    .limit(20_000);
}

/** CSV cell, also defusing spreadsheet formulas (=, +, -, @) in text. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}