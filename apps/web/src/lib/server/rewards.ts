import "server-only";
import { and, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { couponRedemptions, coupons, customers, getDb, loyaltyLedger, orders, storeSettings } from "@seiketsu/db";
import { checkCoupon, normalizeCode } from "@seiketsu/core/coupons";
import { LOYALTY_OFF, pointsEarned, redeemable, type LoyaltySettings } from "@seiketsu/core/loyalty";

export type Coupon = typeof coupons.$inferSelect;

export async function loyaltySettings(outletId: string): Promise<LoyaltySettings> {
  const db = await getDb();
  const [s] = await db.select().from(storeSettings).where(eq(storeSettings.outletId, outletId));
  if (!s) return LOYALTY_OFF;
  return {
    enabled: s.loyaltyEnabled,
    earnPer100: s.loyaltyEarnPer100,
    pointValuePaise: s.loyaltyPointValuePaise,
    minRedeem: s.loyaltyMinRedeem,
    maxRedeemPercent: s.loyaltyMaxRedeemPercent,
  };
}

export async function pointsBalance(customerId: string) {
  const db = await getDb();
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${loyaltyLedger.points}), 0)::int` }).from(loyaltyLedger).where(eq(loyaltyLedger.customerId, customerId));
  return r?.n ?? 0;
}

export async function pointsForPhone(phone: string) {
  const db = await getDb();
  const [c] = await db.select({ id: customers.id }).from(customers).where(eq(customers.phone, phone));
  return c ? { customerId: c.id, balance: await pointsBalance(c.id) } : null;
}

export async function ledgerFor(customerId: string, limit = 50) {
  const db = await getDb();
  return db.select().from(loyaltyLedger).where(eq(loyaltyLedger.customerId, customerId)).orderBy(desc(loyaltyLedger.createdAt)).limit(limit);
}

/** Uses that still count: not orders that expired unpaid or were turned away. */
const LIVE = sql`${orders.status} not in ('expired', 'rejected', 'cancelled')`;

/** Checks a code for this order. Returns the coupon and discount, or the reason it can't be used. */
export async function evaluateCoupon(outletId: string, rawCode: string, phone: string, subtotalPaise: number) {
  const code = normalizeCode(rawCode);
  if (!code) return { error: "Enter a coupon code." } as const;
  const db = await getDb();
  const [c] = await db.select().from(coupons).where(and(eq(coupons.outletId, outletId), eq(coupons.code, code)));
  if (!c) return { error: "That coupon code isn’t valid." } as const;
  const count = async (extra?: SQL) =>
    (
      await db
        .select({ n: sql<number>`count(*)::int` })
        .from(couponRedemptions)
        .innerJoin(orders, eq(orders.id, couponRedemptions.orderId))
        .where(and(eq(couponRedemptions.couponId, c.id), LIVE, extra))
    )[0].n;
  const [usedTotal, usedByCustomer] = await Promise.all([count(), count(eq(couponRedemptions.customerPhone, phone))]);
  const [paid] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.customerPhone, phone), inArray(orders.paymentState, ["paid", "partially_refunded", "refunded"])));
  const r = checkCoupon({ ...c, kind: c.kind as "percent" | "flat" }, { now: new Date(), subtotalPaise, usedTotal, usedByCustomer, paidOrdersByCustomer: paid.n });
  return r.ok ? ({ coupon: c, discountPaise: r.discountPaise } as const) : ({ error: r.reason } as const);
}

/** After payment: take the spent points off and add the points earned. Safe to call more than once. */
export async function settleLoyalty(orderId: string) {
  const db = await getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o?.customerId) return;
  const s = await loyaltySettings(o.outletId);
  const rows: (typeof loyaltyLedger.$inferInsert)[] = [];
  if (o.loyaltyPointsUsed > 0) rows.push({ customerId: o.customerId, orderId, points: -o.loyaltyPointsUsed, reason: "redeem" });
  const earned = pointsEarned(o.subtotalPaise - o.discountPaise, s);
  if (earned > 0) rows.push({ customerId: o.customerId, orderId, points: earned, reason: "earn" });
  if (rows.length) await db.insert(loyaltyLedger).values(rows).onConflictDoNothing();
}

/** After a refund: take back the points earned and give back the points spent. */
export async function reverseLoyalty(orderId: string) {
  const db = await getDb();
  const rows = await db.select().from(loyaltyLedger).where(and(eq(loyaltyLedger.orderId, orderId), inArray(loyaltyLedger.reason, ["earn", "redeem"])));
  const back = rows.map((r) => ({ customerId: r.customerId, orderId, points: -r.points, reason: r.reason === "earn" ? "reverse_earn" : "return_redeem" }));
  if (back.length) await db.insert(loyaltyLedger).values(back).onConflictDoNothing();
}

export async function adjustPoints(customerId: string, points: number, note: string, staffId: string) {
  const db = await getDb();
  await db.insert(loyaltyLedger).values({ customerId, points, reason: "adjust", note, staffId });
}

export async function couponUsage(outletId: string) {
  const db = await getDb();
  const rows = await db
    .select({ couponId: couponRedemptions.couponId, n: sql<number>`count(*)::int`, off: sql<number>`coalesce(sum(${couponRedemptions.discountPaise}), 0)::int` })
    .from(couponRedemptions)
    .innerJoin(orders, eq(orders.id, couponRedemptions.orderId))
    .where(and(eq(orders.outletId, outletId), ne(orders.paymentState, "unpaid")))
    .groupBy(couponRedemptions.couponId);
  return new Map(rows.map((r) => [r.couponId, r]));
}

export { redeemable };
