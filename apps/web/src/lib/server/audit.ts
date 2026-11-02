import "server-only";
import { auditLog, type Db } from "@seiketsu/db";

export async function audit(
  db: Pick<Db, "insert">,
  entry: { actorId: string | null; outletId?: string | null; action: string; entity: string; entityId?: string | null; data?: unknown },
) {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    outletId: entry.outletId ?? null,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    data: (entry.data ?? null) as object | null,
  });
}