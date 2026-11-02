import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, webhookEvents } from "@seiketsu/db";
import { verifyWebhookSignature } from "@seiketsu/core/razorpay-signature";
import { env } from "./env";
import { markPaymentCaptured, markPaymentFailed, updateRefundStatus } from "./orders";

type PaymentEntity = {
  id: string;
  order_id: string;
  amount: number;
  method?: string;
  error_code?: string;
  error_description?: string;
  fee?: number | null;
  tax?: number | null;
};
type WebhookBody = {
  event: string;
  payload: { payment?: { entity: PaymentEntity }; refund?: { entity: { id: string; status: string } } };
};

export type WebhookOutcome = { status: number; body: string };

/**
 * Verifies and applies one Razorpay webhook delivery. Each event id is stored
 * once; a repeat of an event that already processed is acknowledged and skipped.
 */
export async function handleRazorpayWebhook(rawBody: string, signature: string | null, eventId: string | null): Promise<WebhookOutcome> {
  const secret = env.razorpay.webhookSecret;
  if (!secret) return { status: 503, body: "webhook secret not configured" };
  if (!signature || !verifyWebhookSignature(rawBody, signature, secret)) return { status: 401, body: "bad signature" };

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: "bad json" };
  }
  const id = eventId ?? `sha256:${createHash("sha256").update(rawBody).digest("hex")}`;
  const db = await getDb();
  await db.insert(webhookEvents).values({ id, event: body.event, payload: body }).onConflictDoNothing();
  const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, id));
  if (row?.processedAt) return { status: 200, body: "duplicate" };

  try {
    const pay = body.payload.payment?.entity;
    switch (body.event) {
      case "payment.captured":
      case "order.paid":
        if (pay) {
          await markPaymentCaptured({
            razorpayOrderId: pay.order_id,
            razorpayPaymentId: pay.id,
            amountPaise: Number(pay.amount),
            method: pay.method ?? null,
            feePaise: pay.fee ?? null,
            feeTaxPaise: pay.tax ?? null,
            via: "webhook",
          });
        }
        break;
      case "payment.failed":
        if (pay) await markPaymentFailed({ razorpayOrderId: pay.order_id, code: pay.error_code, description: pay.error_description });
        break;
      case "refund.processed":
      case "refund.failed":
        if (body.payload.refund) await updateRefundStatus(body.payload.refund.entity.id, body.payload.refund.entity.status);
        break;
      default:
        break; // acknowledged, nothing to do
    }
    await db.update(webhookEvents).set({ processedAt: new Date(), error: null }).where(eq(webhookEvents.id, id));
    return { status: 200, body: "ok" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Unknown payment ids (e.g. from another integration on the same account) are recorded, not retried.
    if (message === "Unknown payment.") {
      await db.update(webhookEvents).set({ processedAt: new Date(), error: message }).where(eq(webhookEvents.id, id));
      return { status: 200, body: "ignored" };
    }
    await db.update(webhookEvents).set({ error: message }).where(eq(webhookEvents.id, id));
    console.error("[webhook] processing failed", id, err);
    return { status: 500, body: "processing failed" };
  }
}