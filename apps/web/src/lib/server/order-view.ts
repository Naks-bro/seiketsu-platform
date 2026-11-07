import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, orderEvents, orderItemAddons, orderItems, orders, payments, refunds } from "@seiketsu/db";

/** New invoices retain their issuer details even after an outlet is renamed or edited. */
export function orderIssuer<T extends { name: string; addressLines: string[]; phone: string | null; instagram: string | null }>(order: typeof orders.$inferSelect, fallback: T) {
  return { ...fallback, ...order.issuerSnapshot };
}

export async function loadOrder(where: { token: string } | { id: string }) {
  const db = await getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where("token" in where ? eq(orders.publicToken, where.token) : eq(orders.id, where.id));
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const addons = items.length
    ? await db.select().from(orderItemAddons).where(inArray(orderItemAddons.orderItemId, items.map((i) => i.id)))
    : [];
  const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(asc(orderEvents.id));
  const pays = await db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.createdAt));
  const refundRows = pays.length ? await db.select().from(refunds).where(inArray(refunds.paymentId, pays.map((p) => p.id))) : [];
  return {
    order,
    items: items.map((i) => ({ ...i, addons: addons.filter((a) => a.orderItemId === i.id) })),
    events,
    payments: pays,
    refunds: refundRows,
  };
}

export type OrderView = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;
