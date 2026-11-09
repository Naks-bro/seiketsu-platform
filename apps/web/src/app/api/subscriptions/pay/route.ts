import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import { startSubscriptionPayment } from "@/lib/server/subscription-payments";

const bodySchema = z.object({ token: z.string().min(10).max(100) });

/** Opens the Razorpay order for a subscription's next payment (first payment or a renewal). */
export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`sub-pay:${await clientIp()}`, 20, 600))) return jsonError("Too many attempts.", 429);
    const { token } = bodySchema.parse(await readJson(req));
    return NextResponse.json(await startSubscriptionPayment(token));
  } catch (err) {
    return handleError(err);
  }
}
