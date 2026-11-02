import "server-only";
import { eq } from "drizzle-orm";
import { getDb, orders } from "@seiketsu/db";
import type { CustomerEvent } from "@seiketsu/core/messaging";
import { env } from "./env";
import { alreadySent, getMessagingSettings, sendMessage } from "./messaging/send";
import type { TemplateKind } from "./messaging/templates";

/** "Rs. 450" / "Rs. 450.50": plain ASCII so SMS stays in the cheaper GSM encoding. */
export const rupees = (paise: number) => `Rs. ${paise % 100 ? (paise / 100).toFixed(2) : paise / 100}`;

const KIND: Record<CustomerEvent, TemplateKind> = {
  placed: "order_placed",
  ready: "order_ready",
  out_for_delivery: "order_out_for_delivery",
  completed: "order_completed",
  cancelled: "order_cancelled",
  refunded: "order_refunded",
};

/** Sends the customer the update for an order event, if the owner has it switched on. */
export async function notifyCustomer(orderId: string, event: CustomerEvent, extra: { amountPaise?: number } = {}) {
  if (env.messaging.mode === "disabled") return;
  const db = await getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) return;
  const settings = await getMessagingSettings(o.outletId);
  if (!settings.customerUpdates[event]) return;
  const kind = KIND[event];
  if (await alreadySent(o.id, kind)) return;

  const vars = {
    name: o.customerName.split(/\s+/)[0] || "there",
    order: o.orderNumber,
    total: rupees(o.totalPaise),
    link: `${env.siteUrl}/order/${o.publicToken}`,
    reason: o.statusReason ?? "not available",
    amount: rupees(extra.amountPaise ?? o.totalPaise),
  };
  const ids = { outletId: o.outletId, orderId: o.id, customerId: o.customerId };
  await sendMessage({ kind, to: o.customerPhone, vars, ...ids });
  if (event === "placed" && o.customerEmail) {
    await sendMessage({
      kind,
      channel: "email",
      to: o.customerEmail,
      vars,
      ...ids,
      email: { subject: `Your Seiketsu order ${o.orderNumber} is confirmed` },
    });
  }
}