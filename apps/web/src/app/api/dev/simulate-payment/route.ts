import { NextResponse } from "next/server";
import { z } from "zod";
import { hmacHex } from "@seiketsu/core/razorpay-signature";
import { env, SIMULATOR_SECRET } from "@/lib/server/env";
import { newSimulatorPaymentId } from "@/lib/server/gateway";
import { handleError, jsonError, readJson } from "@/lib/server/http";

const bodySchema = z.object({ razorpay_order_id: z.string().startsWith("order_sim_") });

/**
 * Local development only. Plays the part of Razorpay Checkout: returns a
 * correctly signed success response so the real verify route is exercised.
 */
export async function POST(req: Request) {
  if (env.isProd || env.paymentsMode !== "simulator") return jsonError("Not found.", 404);
  try {
    const { razorpay_order_id } = bodySchema.parse(await readJson(req));
    const razorpay_payment_id = newSimulatorPaymentId();
    const razorpay_signature = hmacHex(`${razorpay_order_id}|${razorpay_payment_id}`, SIMULATOR_SECRET);
    return NextResponse.json({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  } catch (err) {
    return handleError(err);
  }
}