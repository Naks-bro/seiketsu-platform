import { NextResponse } from "next/server";
import { z } from "zod";
import { cartLineSchema, indianMobile } from "@seiketsu/core/checkout-schema";
import { previewRewards } from "@/lib/server/orders";
import { getCustomer } from "@/lib/server/customer-auth";
import { handleError, jsonError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";

const body = z.object({
  lines: z.array(cartLineSchema).min(1).max(40),
  phone: z.union([z.literal(""), indianMobile]).optional(),
  couponCode: z.string().trim().max(20).optional(),
});

/** Preview of a coupon and the signed-in customer's points for the checkout page. The real check happens at checkout. */
export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`rewards:${await clientIp()}`, 60, 600))) return jsonError("Too many attempts. Please wait a few minutes.", 429);
    const input = body.parse(await readJson(req));
    const me = await getCustomer();
    return NextResponse.json(
      await previewRewards({ lines: input.lines, phone: input.phone || me?.phone || null, couponCode: input.couponCode, sessionPhone: me?.phone ?? null }),
    );
  } catch (err) {
    return handleError(err);
  }
}
