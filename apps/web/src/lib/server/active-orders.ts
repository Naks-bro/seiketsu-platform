import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, orderItemAddons, orderItems, orders } from "@seiketsu/db";
import { ACTIVE_STATUSES } from "@seiketsu/core/order-status";

export type Ticket = {
  id: string;
  orderNumber: string;
  status: (typeof ACTIVE_STATUSES)[number];
  fulfilment: "pickup" | "delivery";
  source: string;
  customerName: string;
  tableLabel: string | null;
  notes: string | null;
  placedAt: string;
  items: { id: string; name: string; variant: string | null; quantity: number; note: string | null; addons: string[] }[];
};

/** Paid orders the kitchen still has to deal with, oldest first. */
export async function activeTickets(outletId: string): Promise<Ticket[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.outletId, outletId), inArray(orders.status, ACTIVE_STATUSES)))
    .orderBy(asc(orders.placedAt))
    .limit(100);
  if (!rows.length) return [];
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((o) => o.id)));
  const addons = items.length
    ? await db.select().from(orderItemAddons).where(inArray(orderItemAddons.orderItemId, items.map((i) => i.id)))
    : [];
  return rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status as Ticket["status"],
    fulfilment: o.fulfilment,
    source: o.source,
    customerName: o.customerName,
    tableLabel: o.tableLabel,
    notes: o.notes,
    placedAt: (o.placedAt ?? o.createdAt).toISOString(),
    items: items
      .filter((i) => i.orderId === o.id)
      .map((i) => ({
        id: i.id,
        name: i.itemName,
        variant: i.variantLabel,
        quantity: i.quantity,
        note: i.note,
        addons: addons.filter((a) => a.orderItemId === i.id).map((a) => a.name),
      })),
  }));
}