import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, storeSettings } from "@seiketsu/db";
import { can, requireStaff } from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const staff = await requireStaff();
  const db = await getDb();
  const [s] = await db.select().from(storeSettings).where(eq(storeSettings.outletId, staff.outletId));
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Store settings</h1>
        <p className="text-sm text-muted">Changes apply to the website immediately.</p>
      </div>
      <div className="rounded-xl border border-line bg-white p-4 text-sm">
        <p className="font-medium">Online payments</p>
        <p className="text-muted">
          {env.paymentsMode === "razorpay"
            ? `Razorpay ${env.razorpay.isLive ? "LIVE mode: real money" : "Test mode: no real money is charged"}.`
            : env.paymentsMode === "simulator"
              ? "Local payment simulator (development only)."
              : "Not configured. Customers can browse but cannot pay online."}
          {env.paymentsMode === "razorpay" && !env.razorpay.webhookSecret && " Webhook secret missing: set RAZORPAY_WEBHOOK_SECRET."}
        </p>
      </div>
      <SettingsForm
        settings={{
          hours: s.hours,
          temporarilyClosed: s.temporarilyClosed,
          closureMessage: s.closureMessage ?? "",
          announcement: s.announcement ?? "",
          pickupEnabled: s.pickupEnabled,
          deliveryEnabled: s.deliveryEnabled,
          deliveryPincodes: s.deliveryPincodes.join(", "),
          deliveryFee: s.deliveryFeePaise / 100,
          freeDeliveryAbove: s.freeDeliveryAbovePaise != null ? s.freeDeliveryAbovePaise / 100 : "",
          minOrder: s.minOrderPaise / 100,
          prepTime: s.prepTimeMinutes,
          taxEnabled: s.taxEnabled,
          taxRate: s.taxRateBps / 100,
          taxInclusive: s.taxInclusive,
          gstin: s.gstin ?? "",
        }}
        canEditTax={can.manageTax(staff)}
      />
    </div>
  );
}