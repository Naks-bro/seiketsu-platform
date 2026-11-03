import type { Metadata } from "next";
import Link from "next/link";
import { daysLabel } from "@seiketsu/core/subscriptions";
import { can, requirePage } from "@/lib/server/auth";
import { listPlans, planSubscriberCounts } from "@/lib/server/subscriptions";
import { PageHeader, btnPrimary } from "@/components/admin/ui";
import { formatINR } from "@/lib/format";
import { SubTabs } from "../tabs";

export const metadata: Metadata = { title: "Subscription plans" };

export default async function PlansPage() {
  const staff = await requirePage(can.manageOrders);
  const [plans, counts] = await Promise.all([listPlans(staff.outletId), planSubscriberCounts(staff.outletId)]);
  const edit = can.manageMenu(staff);

  return (
    <div className="space-y-6">
      <PageHeader title="Plans" lede="What customers can subscribe to. Only plans switched on appear on the website.">
        <SubTabs current="plans" />
        {edit && <Link href="/admin/subscriptions/plans/new" className={btnPrimary}>New plan</Link>}
      </PageHeader>
      {plans.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
          No plans yet.{edit && <> <Link href="/admin/subscriptions/plans/new" className="font-medium text-berry underline">Create your first plan</Link>.</>}
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const n = counts.get(p.id) ?? 0;
            return (
              <li key={p.id} className="flex flex-col rounded-2xl border border-line bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-2xl leading-tight">{p.name}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${p.isActive ? "bg-veg/10 text-veg" : "bg-paper text-muted"}`}>{p.isActive ? "On website" : "Hidden"}</span>
                </div>
                {p.tagline && <p className="mt-1 text-sm text-muted">{p.tagline}</p>}
                <p className="mt-3 tabular text-lg font-semibold">{formatINR(p.pricePaise)}</p>
                <p className="text-sm text-muted">{p.mealsTotal} meals · {p.durationDays} days · {daysLabel(p.deliveryDays)}</p>
                <p className="mt-2 text-sm">{n} current subscriber{n === 1 ? "" : "s"}</p>
                {edit && <Link href={`/admin/subscriptions/plans/${p.id}`} className="mt-auto pt-4 text-sm font-medium text-berry hover:underline">Edit plan →</Link>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
