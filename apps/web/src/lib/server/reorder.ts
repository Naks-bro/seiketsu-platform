import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb, orderItemAddons, orderItems, orders } from "@seiketsu/db";
import { buildReorder, type Reorder } from "../reorder";
import { getMenu, getStore } from "./catalog";

/**
 * A past order as cart lines from today's menu at the customer's current outlet. Anyone holding the order's link
 * can see the order already, so the same link is enough to order it again; nothing is charged or saved here.
 */
export async function reorderByToken(token: string): Promise<Reorder | null> {
  const db = await getDb();
  const [order] = await db.select({ id: orders.id, status: orders.status }).from(orders).where(eq(orders.publicToken, token));
  if (!order || order.status === "pending_payment" || order.status === "expired") return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const extras = items.length ? await db.select().from(orderItemAddons).where(inArray(orderItemAddons.orderItemId, items.map((i) => i.id))) : [];
  const store = await getStore();
  const menu = await getMenu(store.outletId);
  return buildReorder(
    items.map((i) => ({
      menuItemId: i.menuItemId,
      variantId: i.variantId,
      itemName: i.itemName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      note: i.note,
      unitPricePaise: i.unitPricePaise,
      addons: extras.filter((a) => a.orderItemId === i.id).map((a) => ({ addonId: a.addonId, name: a.name, pricePaise: a.pricePaise })),
    })),
    menu,
  );
}
