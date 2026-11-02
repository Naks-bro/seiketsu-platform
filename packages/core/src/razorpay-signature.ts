/** Server-only. Razorpay signature checks (HMAC-SHA256, hex). */
import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqualHex(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hmacHex(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Checkout handler response: signature = HMAC(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(args: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = hmacHex(`${args.razorpayOrderId}|${args.razorpayPaymentId}`, args.keySecret);
  return safeEqualHex(expected, args.signature);
}

/** Webhook: X-Razorpay-Signature = HMAC(raw request body, webhook_secret). */
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  return safeEqualHex(hmacHex(rawBody, webhookSecret), signature);
}
