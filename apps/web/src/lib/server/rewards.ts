import "server-only";
import { and, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { couponRedemptions, coupons, customers, getDb, loyaltyLedger, orders, storeSettings, type Db } from "@seiketsu/db";
import { checkCoupon, normalizeCode } from "@seiketsu/core/coupons";
import { LOYALTY_OFF, pointsEarned, redeemable, type LoyaltySettings } from "@seiketsu/core/loyalty";

export type RewardDb = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export type Coupon = typeof coupons.$inferSelect;

export async function loyaltySettings(outletId: string, db?: RewardDb): Promise<LoyaltySettings> {
  db ??= await getDb();
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

export async function pointsBalance(customerId: string, db?: RewardDb) {
  db ??= await getDb();
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${loyaltyLedger.points}), 0)::int` }).from(loyaltyLedger).where(eq(loyaltyLedger.customerId, customerId));
  return r?.n ?? 0;
}

export async function pointsForPhone(phone: string, db?: RewardDb) {
  db ??= await getDb();
  const [c] = await db.select({ id: customers.id }).from(customers).where(eq(customers.phone, phone));
  return c ? { customerId: c.id, balance: await pointsBalance(c.id, db) } : null;
}

export async function ledgerFor(customerId: string, limit = 50) {
  const db = await getDb();
  return db.select().from(loyaltyLedger).where(eq(loyaltyLedger.customerId, customerId)).orderBy(desc(loyaltyLedger.createdAt)).limit(limit);
}

/** Uses that still count: not orders that expired unpaid or were turned away. */
const LIVE = sql`${orders.rewardsReleasedAt} is null and ${orders.status} not in ('rejected', 'cancelled')`;

/** Checks a code for this order. Returns the coupon and discount, or the reason it can't be used. */
export async function evaluateCoupon(outletId: string, rawCode: string, phone: string, subtotalPaise: number, db?: RewardDb, lock = false) {
  const code = normalizeCode(rawCode);
  if (!code) return { error: "Enter a coupon code." } as const;
  db ??= await getDb();
  const query = db.select().from(coupons).where(and(eq(coupons.outletId, outletId), eq(coupons.code, code)));
  const [c] = await (lock ? query.for("update") : query);
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
    .where(and(eq(orders.customerPhone, phone), or(
      inArray(orders.paymentState, ["paid", "partially_refunded", "refunded"]),
      and(LIVE, sql`exists (select 1 from ${couponRedemptions} cr join ${coupons} c on c.id = cr.coupon_id where cr.order_id = ${orders.id} and c.first_order_only)`),
    )));
  const r = checkCoupon({ ...c, kind: c.kind as "percent" | "flat" }, { now: new Date(), subtotalPaise, usedTotal, usedByCustomer, paidOrdersByCustomer: paid.n });
  return r.ok ? ({ coupon: c, discountPaise: r.discountPaise } as const) : ({ error: r.reason } as const);
}

/** Called inside the payment transaction. Order lock serializes capture and refunds. */
export async function settleLoyaltyIn(tx: RewardDb, o: typeof orders.$inferSelect) {
  if (!o.customerId || (o.rewardsReleasedAt && o.discountPaise > 0)) return;
  await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, o.customerId)).for("update");
  const earned = o.loyaltyPointsEarned ?? pointsEarned(o.subtotalPaise - o.discountPaise, await loyaltySettings(o.outletId, tx));
  const rows: (typeof loyaltyLedger.$inferInsert)[] = [];
  // New orders reserve this debit at checkout; conflict protection also supports older unpaid orders.
  if (o.loyaltyPointsUsed > 0) rows.push({ customerId: o.customerId, orderId: o.id, points: -o.loyaltyPointsUsed, reason: "redeem" });
  if (earned > 0) rows.push({ customerId: o.customerId, orderId: o.id, points: earned, reason: "earn" });
  if (rows.length) await tx.insert(loyaltyLedger).values(rows).onConflictDoNothing();
}

export async function reverseLoyaltyIn(tx: RewardDb, orderId: string) {
  const rows = await tx.select().from(loyaltyLedger).where(and(eq(loyaltyLedger.orderId, orderId), inArray(loyaltyLedger.reason, ["earn", "redeem"])));
  const back = rows.map((r) => ({ customerId: r.customerId, orderId, points: -r.points, reason: r.reason === "earn" ? "reverse_earn" : "return_redeem" }));
  if (back.length) await tx.insert(loyaltyLedger).values(back).onConflictDoNothing();
}

/** Release only while holding the order lock. A late capture is refunded instead of reusing released rewards. */
export async function releaseRewardsIn(tx: RewardDb, o: typeof orders.$inferSelect) {
  if (o.customerId) {
    await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, o.customerId)).for("update");
    await reverseLoyaltyIn(tx, o.id);
  }
  if (!o.rewardsReleasedAt) await tx.update(orders).set({ rewardsReleasedAt: new Date() }).where(eq(orders.id, o.id));
}

export async function adjustPoints(customerId: string, points: number, note: string, staffId: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).for("update");
    if (points < 0 && await pointsBalance(customerId, tx) + points < 0) throw new Error("Not enough available points for this adjustment.");
    await tx.insert(loyaltyLedger).values({ customerId, points, reason: "adjust", note, staffId });
  });
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
