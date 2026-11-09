import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, subscriptionPayments, subscriptions } from "@seiketsu/db";
import { handleError, jsonError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import { markSubscriptionFailed } from "@/lib/server/subscription-payments";

const bodySchema = z.object({
  token: z.string().min(10).max(100),
  razorpay_order_id: z.string().min(5).max(100),
  code: z.string().max(100).optional(),
  description: z.string().max(300).optional(),
});

/** Browser report of a failed attempt. Only records the failure; it can never mark anything paid. */
export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`sub-failed:${await clientIp()}`, 30, 600))) return jsonError("Too many attempts.", 429);
    const b = bodySchema.parse(await readJson(req));
    const db = await getDb();
    const [match] = await db
      .select({ id: subscriptionPayments.id })
      .from(subscriptionPayments)
      .innerJoin(subscriptions, eq(subscriptions.id, subscriptionPayments.subscriptionId))
      .where(and(eq(subscriptionPayments.razorpayOrderId, b.razorpay_order_id), eq(subscriptions.publicToken, b.token)));
    if (!match) return jsonError("Not found.", 404);
    await markSubscriptionFailed({ razorpayOrderId: b.razorpay_order_id, code: b.code, description: b.description });
    return NextResponse.json({ status: "failed" });
  } catch (err) {
    return handleError(err);
  }
}
