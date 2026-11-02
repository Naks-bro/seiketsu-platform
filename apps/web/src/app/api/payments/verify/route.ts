import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPaymentSignature } from "@seiketsu/core/razorpay-signature";
import { env } from "@/lib/server/env";
import { confirmCheckoutPayment } from "@/lib/server/orders";
import { handleError, jsonError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";

const bodySchema = z.object({
  token: z.string().min(10).max(100),
  razorpay_order_id: z.string().min(5).max(100),
  razorpay_payment_id: z.string().min(5).max(100),
  razorpay_signature: z.string().min(10).max(200),
});

export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`verify:${await clientIp()}`, 30, 600))) return jsonError("Too many attempts.", 429);
    const b = bodySchema.parse(await readJson(req));
    if (env.paymentsMode === "disabled" || !env.razorpay.keySecret) return jsonError("Payments are not configured.", 503);
    const valid = verifyPaymentSignature({
      razorpayOrderId: b.razorpay_order_id,
      razorpayPaymentId: b.razorpay_payment_id,
      signature: b.razorpay_signature,
      keySecret: env.razorpay.keySecret,
    });
    if (!valid) return jsonError("Payment verification failed.", 400);
    const order = await confirmCheckoutPayment({
      token: b.token,
      razorpayOrderId: b.razorpay_order_id,
      razorpayPaymentId: b.razorpay_payment_id,
    });
    return NextResponse.json({ status: order.status });
  } catch (err) {
    return handleError(err);
  }
}