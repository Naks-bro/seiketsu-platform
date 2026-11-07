import { sql } from "drizzle-orm";
import { getDb, orders } from "@seiketsu/db";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Dependency readiness, with no credentials, counts or customer details in the response. */
export async function GET() {
  try {
    const db = await getDb();
    await db.select({ ready: sql`1`, migration: orders.rewardsReleasedAt }).from(orders).limit(1);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[health] dependency check failed", error instanceof Error ? error.name : "Error");
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
