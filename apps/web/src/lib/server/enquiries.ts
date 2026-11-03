import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { enquiries, getDb } from "@seiketsu/db";

/** Plans enquiries, newest first. */
export async function listEnquiries(outletId: string, limit = 500) {
  const db = await getDb();
  return db.select().from(enquiries).where(eq(enquiries.outletId, outletId)).orderBy(desc(enquiries.createdAt)).limit(limit);
}

/** How many enquiries came in for each interest, and how many still need a reply. */
export async function enquiryCounts(outletId: string) {
  const db = await getDb();
  return db
    .select({
      interest: enquiries.interest,
      total: sql<number>`count(*)::int`,
      waiting: sql<number>`(count(*) filter (where ${enquiries.contactedAt} is null))::int`,
    })
    .from(enquiries)
    .where(eq(enquiries.outletId, outletId))
    .groupBy(enquiries.interest)
    .orderBy(sql`count(*) desc`);
}

export async function markEnquiryContacted(id: string, outletId: string) {
  const db = await getDb();
  const [row] = await db
    .update(enquiries)
    .set({ contactedAt: new Date() })
    .where(and(eq(enquiries.id, id), eq(enquiries.outletId, outletId), isNull(enquiries.contactedAt)))
    .returning({ id: enquiries.id });
  return !!row;
}
