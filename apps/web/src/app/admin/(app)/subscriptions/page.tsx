import type { Metadata } from "next";
import Link from "next/link";
import { formatDay, istToday, progress, SUB_STATUS_LABEL, type SubStatus } from "@seiketsu/core/subscriptions";
import { can, requirePage } from "@/lib/server/auth";
import { dueOn, listPlans, statusCounts } from "@/lib/server/subscriptions";
import { PageHeader } from "@/components/admin/ui";
import { recordDeliveryAction, undoDeliveryAction } from "../../subscription-actions";
import { SubTabs } from "./tabs";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function SubscriptionsToday() {
  const staff = await requirePage(can.manageOrders);
  const today = istToday();
  const [due, counts, plans] = await Promise.all([dueOn(staff.outletId, today), statusCounts(staff.outletId), listPlans(staff.outletId)]);
  const left = due.filter((d) => !d.recorded).length;

  return (
    <div className="space-y-8">
      <PageHeader title="Subscriptions" lede="Today’s subscription meals, your subscribers and the plans customers can choose.">
        <SubTabs current="today" />
      </PageHeader>

      {plans.length === 0 && (
        <p className="rounded-2xl border border-[#e6b450]/50 bg-[#fff7e6] p-4 text-sm">
          <strong>No plans yet.</strong> Create your first plan under{" "}
          <Link href="/admin/subscriptions/plans/new" className="font-medium text-berry underline">Plans</Link>. Customers see plans on the home page once you switch them on.
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-4">
        {(["pending", "active", "paused", "completed"] as SubStatus[]).map((st) => (
          <li key={st}>
            <Link href={`/admin/subscriptions/subscribers?status=${st}`} className="block rounded-2xl border border-line bg-white p-4 hover:border-berry/40">
              <p className="text-sm text-muted">{SUB_STATUS_LABEL[st]}</p>
              <p className="font-display text-3xl tabular">{counts[st]?.n ?? 0}</p>
              {st !== "completed" && (counts[st]?.unpaid ?? 0) > 0 && <p className="text-xs text-berry">{counts[st]!.unpaid} not paid yet</p>}
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="today-h" className="space-y-3">
        <h2 id="today-h" className="font-display text-2xl">
          Meals due today <span className="text-base text-muted">· {formatDay(today)}</span>
        </h2>
        {due.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-muted">No subscription meals are due today.</p>
        ) : (
          <>
            <p className="text-sm text-muted">{left === 0 ? "All done for today." : `${left} still to send.`}</p>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
              {due.map(({ sub, recorded }) => {
                const pr = progress(sub.mealsUsed, sub.mealsTotal);
                return (
                  <li key={sub.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/subscriptions/subscribers/${sub.id}`} className="font-semibold hover:text-berry hover:underline">{sub.name}</Link>
                      <span className="ml-2 text-sm text-muted">{sub.planName} · meal {Math.min(pr.used + (recorded ? 0 : 1), pr.total)} of {pr.total}</span>
                      <p className="truncate text-sm text-muted">
                        {sub.address}
                        {sub.pincode ? `, ${sub.pincode}` : ""} · <a href={`tel:+91${sub.phone}`} className="text-berry">{sub.phone}</a>
                      </p>
                      {sub.notes && <p className="text-xs text-ink/70">“{sub.notes}”</p>}
                    </div>
                    {recorded ? (
                      <form action={undoDeliveryAction} className="flex items-center gap-3 text-sm">
                        <span className={recorded.status === "delivered" ? "font-medium text-veg" : "text-muted"}>{recorded.status === "delivered" ? "✓ Delivered" : "Skipped"}</span>
                        <input type="hidden" name="id" value={sub.id} />
                        <input type="hidden" name="date" value={today} />
                        <button type="submit" className="text-xs text-muted underline hover:text-ink">Undo<span className="sr-only"> for {sub.name}</span></button>
                      </form>
                    ) : (
                      <div className="flex gap-2">
                        {(["delivered", "skipped"] as const).map((st) => (
                          <form key={st} action={recordDeliveryAction}>
                            <input type="hidden" name="id" value={sub.id} />
                            <input type="hidden" name="date" value={today} />
                            <input type="hidden" name="status" value={st} />
                            <button
                              type="submit"
                              className={st === "delivered" ? "rounded-full bg-berry px-4 py-2 text-sm font-semibold text-cream hover:bg-berry-deep" : "rounded-full border border-line px-4 py-2 text-sm hover:bg-paper"}
                            >
                              {st === "delivered" ? "Delivered" : "Skip"}
                              <span className="sr-only"> for {sub.name}</span>
                            </button>
                          </form>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="text-xs text-muted">“Skip” records a day without a meal (for example, the customer asked); it doesn’t use up a meal.</p>
      </section>
    </div>
  );
}
