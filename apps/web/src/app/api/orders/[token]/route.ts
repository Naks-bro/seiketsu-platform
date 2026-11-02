import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, orders } from "@seiketsu/db";
import { reconcileOrder } from "@/lib/server/orders";
import { handleError, jsonError } from "@/lib/server/http";

/** Minimal status for the tracking page. The token is the secret. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const db = await getDb();
    let [order] = await db.select().from(orders).where(eq(orders.publicToken, token));
    if (!order) return jsonError("Not found.", 404);
    order = await reconcileOrder(order);
    return NextResponse.json(
      { status: order.status, paymentState: order.paymentState, updatedAt: order.updatedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return handleError(err);
  }
}