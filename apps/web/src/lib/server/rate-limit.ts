import "server-only";
import { getDb, rateLimits } from "@seiketsu/db";
import { lt, sql } from "drizzle-orm";

/**
 * Fixed-window rate limit stored in Postgres, so it holds across serverless
 * instances. Returns true when the call is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const db = await getDb();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  return row.count <= limit;
}

export async function purgeOldRateLimits() {
  const db = await getDb();
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(Date.now() - 8 * 24 * 3600 * 1000)));
}