import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/server/env";
import { reconcileRefunds, reconcileStale } from "@/lib/server/orders";
import { purgeOldRateLimits } from "@/lib/server/rate-limit";
import { checkAlerts } from "@/lib/server/alerts";
import { sweepStockDeductions } from "@/lib/server/inventory";
import { reconcileSubscriptionPayments } from "@/lib/server/subscription-payments";

/** Scheduled by the GitHub Actions cron (every 10 minutes). It sends "Authorization: Bearer <CRON_SECRET>". */
export const maxDuration = 60;

export async function GET(req: Request) {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.cronSecret ?? ""}`);
  if (!env.cronSecret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const started = Date.now();
  const result = await reconcileStale(50, started + 15_000);
  const refundsChecked = await reconcileRefunds(25, started + 35_000);
  const subscriptionsPaid = await reconcileSubscriptionPayments(25, started + 45_000);
  const stockDeducted = await sweepStockDeductions();
  const alerts = await checkAlerts();
  await purgeOldRateLimits();
  return NextResponse.json({ ...result, refundsChecked, subscriptionsPaid, stockDeducted, alerts });
}