import "server-only";
import { cookies } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { getDb, outletMenuItems, outlets, staffRoles, storeSettings } from "@seiketsu/db";
import { env } from "./env";

export const OUTLET_COOKIE = "seiketsu_outlet";
export const ADMIN_OUTLET_COOKIE = "seiketsu_admin_outlet";

/** A cookie's value, or null outside a request (tests, scripts, the cron job). */
export async function readCookie(name: string) {
  try {
    return (await cookies()).get(name)?.value ?? null;
  } catch {
    return null;
  }
}

/** Outlets customers can choose, with what the location sheet needs to route them. */
export async function activeOutlets() {
  const db = await getDb();
  const rows = await db
    .select({ o: outlets, s: storeSettings })
    .from(outlets)
    .innerJoin(storeSettings, eq(storeSettings.outletId, outlets.id))
    .where(eq(outlets.isActive, true))
    .orderBy(asc(outlets.createdAt));
  return rows.map(({ o, s }) => ({
    id: o.id,
    slug: o.slug,
    name: o.name,
    area: shortName(o.name),
    addressLines: o.addressLines,
    pickupEnabled: s.pickupEnabled,
    deliveryEnabled: s.deliveryEnabled,
    pincodes: s.deliveryPincodes,
  }));
}

/** "Seiketsu Versova" → "Versova": how an outlet is named in the pickup pill. */
export const shortName = (name: string) => name.replace(/^seiketsu\s+/i, "").trim() || name;

/** The outlet this visitor is ordering from: their choice if it is still open for business, else the default. */
export async function chosenOutletSlug() {
  const chosen = await readCookie(OUTLET_COOKIE);
  if (!chosen || chosen === env.outletSlug) return env.outletSlug;
  const db = await getDb();
  const [o] = await db.select({ slug: outlets.slug }).from(outlets).where(and(eq(outlets.slug, chosen), eq(outlets.isActive, true)));
  return o?.slug ?? env.outletSlug;
}

export async function staffOutlets(staffUserId: string) {
  const db = await getDb();
  return db
    .select({ id: outlets.id, name: outlets.name, role: staffRoles.role })
    .from(staffRoles)
    .innerJoin(outlets, eq(outlets.id, staffRoles.outletId))
    .where(eq(staffRoles.staffUserId, staffUserId))
    .orderBy(asc(outlets.createdAt));
}

export async function allOutlets() {
  const db = await getDb();
  return db.select().from(outlets).orderBy(asc(outlets.createdAt));
}

export type OutletFields = { name: string; slug: string; addressLines: string[]; phone: string | null; whatsapp: string | null; instagram: string | null; mapUrl: string | null };

export class OutletError extends Error {}

/**
 * Opens a new outlet by copying an existing one's settings and menu availability. It starts closed, with
 * delivery off and no pincodes, so it takes no orders until the owner sets it up; the creator becomes its owner.
 */
export async function createOutlet(fromOutletId: string, f: OutletFields, ownerId: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [clash] = await tx.select({ id: outlets.id }).from(outlets).where(eq(outlets.slug, f.slug));
    if (clash) throw new OutletError("Another outlet already uses that short name.");
    const [o] = await tx.insert(outlets).values(f).returning();
    const [src] = await tx.select().from(storeSettings).where(eq(storeSettings.outletId, fromOutletId));
    const copy = src ? { ...src } : {};
    if ("outletId" in copy) delete (copy as Partial<typeof storeSettings.$inferSelect>).outletId;
    await tx.insert(storeSettings).values({
      ...(src ? copy : {}),
      outletId: o.id,
      temporarilyClosed: true,
      closureMessage: "Opening soon",
      deliveryEnabled: false,
      deliveryPincodes: [],
    });
    const avail = await tx.select().from(outletMenuItems).where(eq(outletMenuItems.outletId, fromOutletId));
    if (avail.length) await tx.insert(outletMenuItems).values(avail.map((a) => ({ ...a, outletId: o.id })));
    await tx.insert(staffRoles).values({ staffUserId: ownerId, outletId: o.id, role: "owner" });
    return o;
  });
}

export async function updateOutlet(id: string, f: Omit<OutletFields, "slug"> & { isActive: boolean }) {
  const db = await getDb();
  if (!f.isActive) {
    const [o] = await db.select({ slug: outlets.slug }).from(outlets).where(eq(outlets.id, id));
    if (o?.slug === env.outletSlug) throw new OutletError("The main outlet can’t be hidden. It is where the website starts.");
  }
  const [row] = await db.update(outlets).set(f).where(eq(outlets.id, id)).returning();
  return row;
}
