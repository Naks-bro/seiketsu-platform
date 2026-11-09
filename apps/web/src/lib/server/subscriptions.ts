import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, subscriptionDeliveries, subscriptionPlans, subscriptions } from "@seiketsu/db";
import { addDays, canMove, daysBetween, endDateFor, isDue, istToday, type SubStatus } from "@seiketsu/core/subscriptions";

export type Plan = typeof subscriptionPlans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;

export class SubscriptionError extends Error {}

export async function listPlans(outletId: string, activeOnly = false) {
  const db = await getDb();
  const where = activeOnly ? and(eq(subscriptionPlans.outletId, outletId), eq(subscriptionPlans.isActive, true)) : eq(subscriptionPlans.outletId, outletId);
  return db.select().from(subscriptionPlans).where(where).orderBy(asc(subscriptionPlans.sort), asc(subscriptionPlans.pricePaise));
}

export async function getPlan(outletId: string, id: string) {
  const db = await getDb();
  const [p] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.outletId, outletId), eq(subscriptionPlans.id, id)));
  return p ?? null;
}

export async function getActivePlanBySlug(outletId: string, slug: string) {
  const db = await getDb();
  const [p] = await db
    .select()
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.outletId, outletId), eq(subscriptionPlans.slug, slug), eq(subscriptionPlans.isActive, true)));
  return p ?? null;
}

export type PlanInput = Omit<typeof subscriptionPlans.$inferInsert, "id" | "outletId" | "createdAt" | "updatedAt">;

export async function savePlan(outletId: string, input: PlanInput, id?: string) {
  const db = await getDb();
  const clash = await db
    .select({ id: subscriptionPlans.id })
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.outletId, outletId), eq(subscriptionPlans.slug, input.slug)));
  if (clash.some((c) => c.id !== id)) throw new SubscriptionError("Another plan already uses that web address. Change the name or address.");
  if (id) {
    const [row] = await db.update(subscriptionPlans).set(input).where(and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.outletId, outletId))).returning();
    if (!row) throw new SubscriptionError("Plan not found.");
    return row;
  }
  const [row] = await db.insert(subscriptionPlans).values({ ...input, outletId }).returning();
  return row;
}

export async function planSubscriberCounts(outletId: string) {
  const db = await getDb();
  const rows = await db
    .select({ planId: subscriptions.planId, n: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(and(eq(subscriptions.outletId, outletId), or(eq(subscriptions.status, "active"), eq(subscriptions.status, "paused"), eq(subscriptions.status, "pending"))))
    .groupBy(subscriptions.planId);
  return new Map(rows.map((r) => [r.planId, r.n]));
}

export async function statusCounts(outletId: string) {
  const db = await getDb();
  const rows = await db
    .select({ status: subscriptions.status, n: sql<number>`count(*)::int`, unpaid: sql<number>`(count(*) filter (where ${subscriptions.paidAt} is null))::int` })
    .from(subscriptions)
    .where(eq(subscriptions.outletId, outletId))
    .groupBy(subscriptions.status);
  return Object.fromEntries(rows.map((r) => [r.status, { n: r.n, unpaid: r.unpaid }])) as Partial<Record<SubStatus, { n: number; unpaid: number }>>;
}

export async function listSubscribers(outletId: string, status?: SubStatus) {
  const db = await getDb();
  const where = status ? and(eq(subscriptions.outletId, outletId), eq(subscriptions.status, status)) : eq(subscriptions.outletId, outletId);
  return db.select().from(subscriptions).where(where).orderBy(desc(subscriptions.createdAt)).limit(500);
}

async function deliveriesOf(subscriptionId: string) {
  const db = await getDb();
  return db.select().from(subscriptionDeliveries).where(eq(subscriptionDeliveries.subscriptionId, subscriptionId)).orderBy(desc(subscriptionDeliveries.date));
}

export async function getSubscription(outletId: string, id: string) {
  const db = await getDb();
  const [sub] = await db.select().from(subscriptions).where(and(eq(subscriptions.outletId, outletId), eq(subscriptions.id, id)));
  return sub ? { sub, deliveries: await deliveriesOf(sub.id) } : null;
}

export async function getSubscriptionByToken(token: string) {
  const db = await getDb();
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.publicToken, token));
  return sub ? { sub, deliveries: await deliveriesOf(sub.id) } : null;
}

export async function subscriptionsForPhone(phone: string) {
  const db = await getDb();
  return db.select().from(subscriptions).where(eq(subscriptions.phone, phone)).orderBy(desc(subscriptions.createdAt)).limit(20);
}

/** Active subscriptions with a meal due on `date`, with what has been recorded for that day. */
export async function dueOn(outletId: string, date: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.outletId, outletId),
        or(eq(subscriptions.status, "active"), eq(subscriptions.status, "completed")),
        lte(subscriptions.startDate, date),
        or(isNull(subscriptions.endDate), gte(subscriptions.endDate, date)),
      ),
    )
    .orderBy(asc(subscriptions.name));
  const recorded = await db.select().from(subscriptionDeliveries).where(eq(subscriptionDeliveries.date, date));
  const byId = new Map(recorded.map((d) => [d.subscriptionId, d]));
  // A meal recorded today still shows (so it can be undone), even if it was the last one.
  return rows.filter((s) => byId.has(s.id) || isDue(s, date)).map((s) => ({ sub: s, recorded: byId.get(s.id) ?? null }));
}

export async function createSubscription(input: {
  outletId: string;
  plan: Plan;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  pincode: string | null;
  startDate: string;
  notes: string | null;
}) {
  const db = await getDb();
  const [row] = await db
    .insert(subscriptions)
    .values({
      outletId: input.outletId,
      planId: input.plan.id,
      publicToken: randomBytes(18).toString("base64url"),
      planName: input.plan.name,
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      pincode: input.pincode,
      startDate: input.startDate,
      endDate: endDateFor(input.startDate, input.plan.durationDays),
      mealsTotal: input.plan.mealsTotal,
      durationDays: input.plan.durationDays,
      deliveryDays: input.plan.deliveryDays,
      pricePaise: input.plan.pricePaise,
      notes: input.notes,
    })
    .returning();
  return row;
}

/** Changes a subscription's status. Pausing remembers the day; resuming moves the end date on by the days paused. */
export async function moveSubscription(outletId: string, id: string, to: SubStatus, today = istToday()) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [sub] = await tx.select().from(subscriptions).where(and(eq(subscriptions.id, id), eq(subscriptions.outletId, outletId))).for("update");
    if (!sub) throw new SubscriptionError("Subscription not found.");
    if (!canMove(sub.status as SubStatus, to)) throw new SubscriptionError(`A ${sub.status} subscription cannot be set to ${to}.`);
    const patch: Partial<Subscription> = { status: to };
    if (to === "active" && sub.status === "pending") {
      // Confirming late: start no earlier than today, and run the full plan from then.
      const start = sub.startDate < today ? today : sub.startDate;
      patch.startDate = start;
      patch.endDate = endDateFor(start, sub.durationDays);
    }
    if (to === "paused") patch.pausedOn = today;
    if (to === "active" && sub.status === "paused") {
      const paused = sub.pausedOn ? Math.max(0, daysBetween(sub.pausedOn, today)) : 0;
      patch.endDate = sub.endDate ? addDays(sub.endDate, paused) : null;
      patch.pausedOn = null;
    }
    const [row] = await tx.update(subscriptions).set(patch).where(eq(subscriptions.id, id)).returning();
    return row;
  });
}

export async function saveStaffNotes(outletId: string, id: string, staffNotes: string | null) {
  const db = await getDb();
  await db.update(subscriptions).set({ staffNotes }).where(and(eq(subscriptions.id, id), eq(subscriptions.outletId, outletId)));
}

/** Records a delivered (or skipped) meal for one day. A delivered meal counts towards the plan; the last one finishes it. */
export async function recordDelivery(outletId: string, id: string, date: string, status: "delivered" | "skipped", staffId: string | null) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [sub] = await tx.select().from(subscriptions).where(and(eq(subscriptions.id, id), eq(subscriptions.outletId, outletId))).for("update");
    if (!sub) throw new SubscriptionError("Subscription not found.");
    if (!isDue(sub, date)) throw new SubscriptionError("No meal is due for this subscription on that day.");
    const inserted = await tx.insert(subscriptionDeliveries).values({ subscriptionId: id, date, status, staffId }).onConflictDoNothing().returning();
    if (!inserted.length) throw new SubscriptionError("That day is already recorded.");
    if (status === "delivered") {
      const used = sub.mealsUsed + 1;
      await tx.update(subscriptions).set({ mealsUsed: used, status: used >= sub.mealsTotal ? "completed" : sub.status }).where(eq(subscriptions.id, id));
    }
  });
}

/** Undoes what was recorded for a day (a mis-tap at the counter). */
export async function undoDelivery(outletId: string, id: string, date: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [sub] = await tx.select().from(subscriptions).where(and(eq(subscriptions.id, id), eq(subscriptions.outletId, outletId))).for("update");
    if (!sub) throw new SubscriptionError("Subscription not found.");
    const [gone] = await tx
      .delete(subscriptionDeliveries)
      .where(and(eq(subscriptionDeliveries.subscriptionId, id), eq(subscriptionDeliveries.date, date)))
      .returning();
    if (gone?.status === "delivered") {
      await tx
        .update(subscriptions)
        .set({ mealsUsed: Math.max(0, sub.mealsUsed - 1), status: sub.status === "completed" ? "active" : sub.status })
        .where(eq(subscriptions.id, id));
    }
  });
}
