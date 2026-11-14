import type { Metadata } from "next";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { deliveryZones, getDb, orders, outlets, storeSettings } from "@seiketsu/db";
import { toZone } from "@/lib/server/catalog";
import { can, requirePage } from "@/lib/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { PincodeImport } from "./pincode-import";
import { PincodeList } from "./pincode-list";
import { ZonesEditor } from "./zones-editor";

export const metadata: Metadata = { title: "Delivery areas" };

/** Orders per delivery zone over the last 30 days. */
async function ordersByZone(outletId: string) {
  const db = await getDb();
  const zone = sql<string>`${orders.address}->>'zoneId'`;
  return db
    .select({ zone, n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.outletId, outletId), gte(orders.createdAt, new Date(Date.now() - 30 * 86_400_000)), sql`${zone} is not null`))
    .groupBy(zone);
}

export default async function DeliveryAreasPage() {
  const staff = await requirePage(can.manageSettings);
  const db = await getDb();
  const [s] = await db
    .select({ pins: storeSettings.deliveryPincodes, deliveryEnabled: storeSettings.deliveryEnabled })
    .from(storeSettings)
    .where(eq(storeSettings.outletId, staff.outletId));
  const pins = s?.pins ?? [];
  const [[o], zoneRows, used] = await Promise.all([
    db.select({ lat: outlets.lat, lng: outlets.lng }).from(outlets).where(eq(outlets.id, staff.outletId)),
    db.select().from(deliveryZones).where(eq(deliveryZones.outletId, staff.outletId)).orderBy(asc(deliveryZones.sort), asc(deliveryZones.createdAt)),
    ordersByZone(staff.outletId),
  ]);
  const zones = zoneRows.map(toZone);
  const counts = Object.fromEntries(used.map((u) => [u.zone, u.n]));
  const zonesOn = zones.some((z) => z.active) && o?.lat != null;

  return (
    <div className="space-y-8">
      <PageHeader title="Delivery areas" lede="The pincodes you deliver to. Customers outside them are sent to the “not in your area yet” page and can ask you to come.">
        <a href="/api/admin/delivery-areas?template=1" className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-paper">
          Excel template
        </a>
        {pins.length > 0 && (
          <a href="/api/admin/delivery-areas" className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-paper">
            Download list
          </a>
        )}
      </PageHeader>

      <p role="status" className={`rounded-2xl border p-4 text-sm ${pins.length ? "border-veg/30 bg-veg/5" : "border-[#e6b450]/50 bg-[#fff7e6]"}`}>
        {pins.length ? (
          <>Delivering to <strong>{pins.length}</strong> pincode{pins.length === 1 ? "" : "s"}.</>
        ) : (
          <>
            <strong>No pincodes yet, so every pincode counts as one you deliver to.</strong> Add your pincodes below to limit delivery to
            those areas.
          </>
        )}
        {s && !s.deliveryEnabled && <> Delivery is switched off in Settings, so customers can only choose pickup.</>}
      </p>

      <ZonesEditor initialZones={zones} initialLocation={o?.lat != null && o?.lng != null ? { lat: o.lat, lng: o.lng } : null} counts={counts} />

      {zonesOn && (
        <p className="rounded-2xl border border-line bg-white p-4 text-sm text-muted">
          Zones are on, so customers&apos; map pins decide delivery. The pincode list below is only used if every zone is paused.
        </p>
      )}
      <PincodeImport current={pins} />
      <PincodeList pins={pins} />
    </div>
  );
}
