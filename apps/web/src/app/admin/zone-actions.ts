"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { deliveryZones, getDb, outlets } from "@seiketsu/db";
import { isLatLng, zoneProblem, type DeliveryZone } from "@seiketsu/core/delivery-zones";
import { can, requireStaff } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { toZone } from "@/lib/server/catalog";

export type ZoneResult = { ok: true; zones: DeliveryZone[]; location: { lat: number; lng: number } | null } | { ok: false; error: string };

async function editor() {
  const staff = await requireStaff();
  if (!can.manageSettings(staff)) throw new Error("You do not have permission to change delivery zones.");
  return staff;
}

async function snapshot(outletId: string): Promise<ZoneResult> {
  const db = await getDb();
  const [o] = await db.select({ lat: outlets.lat, lng: outlets.lng }).from(outlets).where(eq(outlets.id, outletId));
  const rows = await db.select().from(deliveryZones).where(eq(deliveryZones.outletId, outletId)).orderBy(asc(deliveryZones.sort), asc(deliveryZones.createdAt));
  return { ok: true, zones: rows.map(toZone), location: o?.lat != null && o?.lng != null ? { lat: o.lat, lng: o.lng } : null };
}

async function done(outletId: string) {
  revalidatePath("/", "layout");
  return snapshot(outletId);
}

const fail = (e: unknown): ZoneResult => ({ ok: false, error: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Check the zone.") : (e as Error).message });

export async function setOutletLocationAction(p: { lat: number; lng: number }): Promise<ZoneResult> {
  try {
    const staff = await editor();
    if (!isLatLng(p)) return { ok: false, error: "That point is off the map." };
    const db = await getDb();
    await db.update(outlets).set({ lat: p.lat, lng: p.lng }).where(eq(outlets.id, staff.outletId));
    await audit(db, { actorId: staff.id, outletId: staff.outletId, action: "outlet.location", entity: "outlet", entityId: staff.outletId, data: p });
    return done(staff.outletId);
  } catch (e) {
    return fail(e);
  }
}

const rupees = (label: string, max: number) => z.number({ message: `Enter the ${label}` }).min(0, `The ${label} can't be negative`).max(max);

const zoneInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().max(60),
  kind: z.enum(["radius", "polygon"]),
  radiusM: z.number().int().nullable(),
  polygon: z.array(z.tuple([z.number(), z.number()])).nullable(),
  feeRupees: rupees("delivery fee", 5000),
  minOrderRupees: rupees("minimum order", 50000),
  etaMinutes: z.number().int().min(5).max(240).nullable(),
  active: z.boolean(),
  sort: z.number().int().min(0).max(1000),
});

export async function saveZoneAction(input: z.input<typeof zoneInput>): Promise<ZoneResult> {
  try {
    const staff = await editor();
    const z0 = zoneInput.parse(input);
    const now = await snapshot(staff.outletId);
    if (!now.ok) return now;
    const problem = zoneProblem({ name: z0.name, kind: z0.kind, radiusM: z0.radiusM, polygon: z0.polygon }, now.location);
    if (problem) return { ok: false, error: problem };
    const ring = z0.kind === "polygon" && z0.polygon ? z0.polygon : null;
    // Store outlines closed, as GeoJSON (and PostGIS) expect.
    const closed = ring && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ? [...ring, ring[0]] : ring;
    const values = {
      name: z0.name,
      kind: z0.kind,
      radiusM: z0.kind === "radius" ? z0.radiusM : null,
      polygon: closed,
      feePaise: Math.round(z0.feeRupees * 100),
      minOrderPaise: Math.round(z0.minOrderRupees * 100),
      etaMinutes: z0.etaMinutes,
      isActive: z0.active,
      sort: z0.sort,
    };
    const db = await getDb();
    const [row] = z0.id
      ? await db.update(deliveryZones).set(values).where(and(eq(deliveryZones.id, z0.id), eq(deliveryZones.outletId, staff.outletId))).returning({ id: deliveryZones.id })
      : await db.insert(deliveryZones).values({ ...values, outletId: staff.outletId }).returning({ id: deliveryZones.id });
    if (!row) return { ok: false, error: "That zone was not found." };
    await audit(db, { actorId: staff.id, outletId: staff.outletId, action: z0.id ? "zone.update" : "zone.create", entity: "delivery_zone", entityId: row.id, data: { ...values, polygon: closed ? `${closed.length} points` : null } });
    return done(staff.outletId);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteZoneAction(id: string): Promise<ZoneResult> {
  try {
    const staff = await editor();
    const db = await getDb();
    const [gone] = await db.delete(deliveryZones).where(and(eq(deliveryZones.id, id), eq(deliveryZones.outletId, staff.outletId))).returning({ name: deliveryZones.name });
    if (gone) await audit(db, { actorId: staff.id, outletId: staff.outletId, action: "zone.delete", entity: "delivery_zone", entityId: id, data: gone });
    return done(staff.outletId);
  } catch (e) {
    return fail(e);
  }
}
