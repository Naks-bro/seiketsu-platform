import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/server/env";
import { reconcileStale } from "@/lib/server/orders";
import { purgeOldRateLimits } from "@/lib/server/rate-limit";
import { checkAlerts } from "@/lib/server/alerts";

/** Scheduled by vercel.json. Vercel sends "Authorization: Bearer <CRON_SECRET>". */
export async function GET(req: Request) {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.cronSecret ?? ""}`);
  if (!env.cronSecret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await reconcileStale();
  const alerts = await checkAlerts();
  await purgeOldRateLimits();
  return NextResponse.json({ ...result, alerts });
}