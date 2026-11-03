import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, storeSettings } from "@seiketsu/db";
import { can, requirePage } from "@/lib/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { PincodeImport } from "./pincode-import";
import { PincodeList } from "./pincode-list";

export const metadata: Metadata = { title: "Delivery areas" };

export default async function DeliveryAreasPage() {
  const staff = await requirePage(can.manageSettings);
  const db = await getDb();
  const [s] = await db
    .select({ pins: storeSettings.deliveryPincodes, deliveryEnabled: storeSettings.deliveryEnabled })
    .from(storeSettings)
    .where(eq(storeSettings.outletId, staff.outletId));
  const pins = s?.pins ?? [];

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

      <PincodeImport current={pins} />
      <PincodeList pins={pins} />
    </div>
  );
}
