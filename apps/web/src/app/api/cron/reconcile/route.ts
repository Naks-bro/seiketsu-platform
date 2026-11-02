import { NextResponse } from "next/server";
import { env } from "@/lib/server/env";
import { reconcileStale } from "@/lib/server/orders";
import { purgeOldRateLimits } from "@/lib/server/rate-limit";
import { checkAlerts } from "@/lib/server/alerts";

/** Scheduled by vercel.json. Vercel sends "Authorization: Bearer <CRON_SECRET>". */
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await reconcileStale();
  const alerts = await checkAlerts();
  await purgeOldRateLimits();
  return NextResponse.json({ ...result, alerts });
}