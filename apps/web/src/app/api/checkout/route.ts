import { NextResponse } from "next/server";
import { checkoutSchema } from "@seiketsu/core/checkout-schema";
import { createCheckout } from "@/lib/server/orders";
import { handleError, jsonError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";

export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`checkout:${await clientIp()}`, 10, 600))) {
      return jsonError("Too many attempts. Please wait a few minutes.", 429);
    }
    const input = checkoutSchema.parse(await readJson(req));
    return NextResponse.json(await createCheckout(input));
  } catch (err) {
    return handleError(err);
  }
}