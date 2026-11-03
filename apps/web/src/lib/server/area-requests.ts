import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { areaRequests, getDb } from "@seiketsu/db";

/** Requests from outside the delivery area, newest first. */
export async function listAreaRequests(outletId: string, limit = 500) {
  const db = await getDb();
  return db.select().from(areaRequests).where(eq(areaRequests.outletId, outletId)).orderBy(desc(areaRequests.createdAt)).limit(limit);
}

/** Demand per pincode, busiest first. */
export async function areaDemand(outletId: string) {
  const db = await getDb();
  return db
    .select({
      pincode: areaRequests.pincode,
      total: sql<number>`count(*)::int`,
      waiting: sql<number>`(count(*) filter (where ${areaRequests.contactedAt} is null))::int`,
    })
    .from(areaRequests)
    .where(eq(areaRequests.outletId, outletId))
    .groupBy(areaRequests.pincode)
    .orderBy(sql`count(*) desc`, areaRequests.pincode);
}

export async function markAreaRequestContacted(id: string, outletId: string) {
  const db = await getDb();
  const [row] = await db
    .update(areaRequests)
    .set({ contactedAt: new Date() })
    .where(and(eq(areaRequests.id, id), eq(areaRequests.outletId, outletId), isNull(areaRequests.contactedAt)))
    .returning({ id: areaRequests.id });
  return !!row;
}
