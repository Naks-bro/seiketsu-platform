import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, orders, payments } from "@seiketsu/db";
import { markPaymentFailed } from "@/lib/server/orders";
import { handleError, jsonError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";

const bodySchema = z.object({
  token: z.string().min(10).max(100),
  razorpay_order_id: z.string().min(5).max(100),
  code: z.string().max(100).optional(),
  description: z.string().max(300).optional(),
});

/** Browser report of a failed attempt. Only records the failure; it can never mark anything paid. */
export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`pay-failed:${await clientIp()}`, 30, 600))) return jsonError("Too many attempts.", 429);
    const b = bodySchema.parse(await readJson(req));
    const db = await getDb();
    const [match] = await db
      .select({ id: payments.id })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(and(eq(payments.razorpayOrderId, b.razorpay_order_id), eq(orders.publicToken, b.token)));
    if (!match) return jsonError("Not found.", 404);
    const order = await markPaymentFailed({ razorpayOrderId: b.razorpay_order_id, code: b.code, description: b.description });
    return NextResponse.json({ status: order.status });
  } catch (err) {
    return handleError(err);
  }
}