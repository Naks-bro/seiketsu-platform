import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, messageLog, orders, webhookEvents } from "@seiketsu/db";
import { STATUS_LABEL } from "@seiketsu/core/order-status";
import { phoneFromWhatsApp } from "@seiketsu/core/whatsapp-login";
import {
  incomingMessages,
  intentOf,
  orderNotFoundText,
  SERVICE_WINDOW_MS,
  signedInText,
  trackText,
  welcomeText,
  type ReplyContext,
} from "@seiketsu/core/whatsapp-replies";
import { getStore } from "./catalog";
import { env } from "./env";
import { metaWhatsAppText } from "./messaging/providers";
import { rateLimit } from "./rate-limit";

type Payload = Parameters<typeof incomingMessages>[0];

/** Has this customer (10-digit mobile) messaged us recently enough that a reply is still free? */
export async function serviceWindowOpen(phone: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ payload: webhookEvents.payload })
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.event, "whatsapp:messages:message"),
        gte(webhookEvents.receivedAt, new Date(Date.now() - SERVICE_WINDOW_MS)),
        sql`${webhookEvents.payload}::text like ${`%${phone}%`}`,
      ),
    )
    .limit(20);
  return rows.some((r) => incomingMessages(r.payload as Payload).some((m) => phoneFromWhatsApp(m.from) === phone));
}

export type FreeSend = { to: string; body: string; kind: string; outletId?: string | null; orderId?: string | null; customerId?: string | null };

/** Sends a free reply and logs it at zero cost. Callers check the 24-hour window first. */
export async function sendFreeText(a: FreeSend) {
  const db = await getDb();
  const [row] = await db
    .insert(messageLog)
    .values({
      outletId: a.outletId ?? null,
      orderId: a.orderId ?? null,
      customerId: a.customerId ?? null,
      channel: "whatsapp",
      kind: a.kind,
      category: "service",
      recipient: a.to,
      provider: "meta",
      status: "queued",
      costMilliPaise: 0,
    })
    .returning({ id: messageLog.id });
  try {
    const r = await metaWhatsAppText(a.to, a.body);
    await db.update(messageLog).set({ status: "sent", providerMessageId: r.providerMessageId }).where(eq(messageLog.id, row.id));
    return { id: row.id, channel: "whatsapp" as const, status: "sent" as const };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.update(messageLog).set({ status: "failed", error }).where(eq(messageLog.id, row.id));
    console.error(`[message] whatsapp free ${a.kind} failed:`, error);
    return { id: row.id, channel: "whatsapp" as const, status: "failed" as const, error };
  }
}

async function replyContext(): Promise<ReplyContext> {
  const store = await getStore();
  const digits = store.whatsapp?.replace(/\D/g, "") ?? "";
  return { siteUrl: env.siteUrl, mapUrl: store.mapUrl, helpNumber: digits.length === 10 ? `91${digits}` : digits || null };
}

/**
 * Auto-replies to customers who message us: a welcome, order tracking by number, and a confirmation for
 * "Verify on WhatsApp". They are replies to the customer's own message, so they are free.
 */
export async function handleInbound(payload: unknown) {
  if (env.messaging.mode !== "live" || !env.messaging.meta) return;
  const messages = incomingMessages(payload as Payload);
  if (messages.length === 0) return;
  const ctx = await replyContext();
  const db = await getDb();

  for (const m of messages) {
    const phone = phoneFromWhatsApp(m.from);
    if (!phone) continue;
    const intent = intentOf(m.text);
    if (intent.kind === "login") {
      await sendFreeText({ to: phone, body: signedInText(), kind: "auto_login" });
    } else if (intent.kind === "track") {
      const [o] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.orderNumber, intent.orderNumber), eq(orders.customerPhone, phone)))
        .limit(1);
      const body = o
        ? trackText({ orderNumber: o.orderNumber, statusLabel: STATUS_LABEL[o.status], link: `${env.siteUrl}/order/${o.publicToken}` })
        : orderNotFoundText(intent.orderNumber, ctx);
      await sendFreeText({ to: phone, body, kind: "auto_track", outletId: o?.outletId, orderId: o?.id, customerId: o?.customerId });
    } else if (await rateLimit(`wa-welcome:${phone}`, 1, 6 * 60 * 60)) {
      // One welcome per customer every few hours, so a chatty conversation is not answered with the menu each time.
      await sendFreeText({ to: phone, body: welcomeText(ctx), kind: "auto_welcome" });
    }
  }
}
