import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { customers, getDb, loyaltyLedger, orders, subscriptions } from "@seiketsu/db";

const PAID = sql`${orders.paymentState} in ('paid', 'partially_refunded')`;

/** Customers with what they have ordered: count, spend, last order and points. */
export async function listCustomers(outletId: string, q: string, limit = 300) {
  const db = await getDb();
  const term = q.trim();
  const search = term ? or(ilike(customers.name, `%${term}%`), ilike(customers.phone, `%${term.replace(/\D/g, "") || term}%`)) : undefined;
  return db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      tags: customers.tags,
      marketingWhatsapp: customers.marketingWhatsapp,
      marketingEmail: customers.marketingEmail,
      createdAt: customers.createdAt,
      orders: sql<number>`(select count(*)::int from ${orders} where ${orders.customerId} = ${customers.id} and ${orders.outletId} = ${outletId} and ${PAID})`,
      spentPaise: sql<number>`(select coalesce(sum(${orders.totalPaise}), 0)::int from ${orders} where ${orders.customerId} = ${customers.id} and ${orders.outletId} = ${outletId} and ${PAID})`,
      lastOrderAt: sql<Date | null>`(select max(${orders.createdAt}) from ${orders} where ${orders.customerId} = ${customers.id} and ${orders.outletId} = ${outletId} and ${PAID})`,
      points: sql<number>`(select coalesce(sum(${loyaltyLedger.points}), 0)::int from ${loyaltyLedger} where ${loyaltyLedger.customerId} = ${customers.id})`,
    })
    .from(customers)
    .where(search)
    .orderBy(desc(sql`(select max(${orders.createdAt}) from ${orders} where ${orders.customerId} = ${customers.id})`), desc(customers.createdAt))
    .limit(limit);
}

export async function customerDetail(outletId: string, id: string) {
  const db = await getDb();
  const [c] = await db.select().from(customers).where(eq(customers.id, id));
  if (!c) return null;
  const [history, subs] = await Promise.all([
    db.select().from(orders).where(and(eq(orders.customerId, id), eq(orders.outletId, outletId))).orderBy(desc(orders.createdAt)).limit(50),
    db.select().from(subscriptions).where(and(eq(subscriptions.phone, c.phone), eq(subscriptions.outletId, outletId))).orderBy(desc(subscriptions.createdAt)),
  ]);
  return { c, history, subs };
}
