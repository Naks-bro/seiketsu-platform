import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { coupons, getDb } from "@seiketsu/db";
import { can, requirePage } from "@/lib/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { CouponForm } from "./coupon-form";

export const metadata: Metadata = { title: "Coupon" };

/** A Date as the value of <input type="datetime-local"> in India time. */
const local = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16) : "");

export default async function CouponEditPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePage(can.manageMenu);
  const { id } = await params;
  let c = null;
  if (id !== "new") {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const db = await getDb();
    [c] = await db.select().from(coupons).where(and(eq(coupons.id, id), eq(coupons.outletId, staff.outletId)));
    if (!c) notFound();
  }
  return (
    <div className="space-y-6">
      <Link href="/admin/coupons" className="text-sm text-berry hover:underline">← Coupons</Link>
      <PageHeader title={c ? `Edit ${c.code}` : "New coupon"} />
      <CouponForm
        coupon={
          c && {
            id: c.id,
            code: c.code,
            description: c.description ?? "",
            kind: c.kind as "percent" | "flat",
            value: c.kind === "percent" ? c.value : c.value / 100,
            minSubtotal: c.minSubtotalPaise ? c.minSubtotalPaise / 100 : "",
            maxDiscount: c.maxDiscountPaise != null ? c.maxDiscountPaise / 100 : "",
            startsAt: local(c.startsAt),
            endsAt: local(c.endsAt),
            usageLimit: c.usageLimit ?? "",
            perCustomerLimit: c.perCustomerLimit ?? "",
            firstOrderOnly: c.firstOrderOnly,
            isActive: c.isActive,
          }
        }
      />
    </div>
  );
}
