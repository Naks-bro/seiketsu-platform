import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { coupons, getDb } from "@seiketsu/db";
import { describeCoupon } from "@seiketsu/core/coupons";
import { can, requirePage } from "@/lib/server/auth";
import { couponUsage } from "@/lib/server/rewards";
import { PageHeader, btnPrimary } from "@/components/admin/ui";
import { formatDateTime, formatINR } from "@/lib/format";

export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsPage() {
  const staff = await requirePage(can.manageMenu);
  const db = await getDb();
  const [rows, usage] = await Promise.all([db.select().from(coupons).where(eq(coupons.outletId, staff.outletId)).orderBy(asc(coupons.code)), couponUsage(staff.outletId)]);
  const now = new Date();

  return (
    <div className="space-y-6">
      <PageHeader title="Coupons" lede="Codes customers type at checkout. The discount comes off the food, before delivery and GST.">
        <Link href="/admin/coupons/new" className={btnPrimary}>New coupon</Link>
      </PageHeader>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
          No coupons yet. <Link href="/admin/coupons/new" className="font-medium text-berry underline">Create one</Link>, for example WELCOME10 for new customers.
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-paper text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Code</th>
                <th scope="col" className="px-3 py-2">Discount</th>
                <th scope="col" className="px-3 py-2">Valid</th>
                <th scope="col" className="px-3 py-2">Used</th>
                <th scope="col" className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => {
                const u = usage.get(c.id);
                const live = c.isActive && (!c.endsAt || c.endsAt > now) && (!c.startsAt || c.startsAt <= now);
                return (
                  <tr key={c.id} className="align-top">
                    <td className="px-3 py-2">
                      <Link href={`/admin/coupons/${c.id}`} className="font-mono font-semibold text-berry hover:underline">{c.code}</Link>
                      {c.description && <span className="block text-xs text-muted">{c.description}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {describeCoupon({ ...c, kind: c.kind as "percent" | "flat" })}
                      {c.firstOrderOnly && <span className="block text-xs text-muted">First order only</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">
                      {c.startsAt ? formatDateTime(c.startsAt) : "Now"} – {c.endsAt ? formatDateTime(c.endsAt) : "no end"}
                    </td>
                    <td className="px-3 py-2 tabular">
                      {u?.n ?? 0}
                      {c.usageLimit != null && ` / ${c.usageLimit}`}
                      {u && u.off > 0 && <span className="block text-xs text-muted">{formatINR(u.off)} given</span>}
                    </td>
                    <td className="px-3 py-2">{live ? <span className="text-veg">Live</span> : <span className="text-muted">{c.isActive ? "Not in dates" : "Off"}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
