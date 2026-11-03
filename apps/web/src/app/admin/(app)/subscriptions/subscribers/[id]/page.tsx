import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { daysLabel, formatDay, nextStatuses, progress, SUB_STATUS_LABEL, type SubStatus } from "@seiketsu/core/subscriptions";
import { can, requirePage } from "@/lib/server/auth";
import { getSubscription } from "@/lib/server/subscriptions";
import { PageHeader, btnGhost, btnPrimary, field } from "@/components/admin/ui";
import { formatDateTime, formatINR } from "@/lib/format";
import { markPaidAction, moveSubscriptionAction, saveStaffNotesAction, undoDeliveryAction } from "../../../../subscription-actions";
import { STATUS_TONE } from "../../tabs";

export const metadata: Metadata = { title: "Subscriber" };

const MOVE_LABEL: Record<SubStatus, string> = { pending: "Back to new", active: "Activate", paused: "Pause", completed: "Mark finished", cancelled: "Cancel plan" };

export default async function SubscriberPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePage(can.manageOrders);
  const { id } = await params;
  const found = /^[0-9a-f-]{36}$/.test(id) ? await getSubscription(staff.outletId, id) : null;
  if (!found) notFound();
  const { sub, deliveries } = found;
  const status = sub.status as SubStatus;
  const pr = progress(sub.mealsUsed, sub.mealsTotal);
  const manage = can.manageMenu(staff);

  return (
    <div className="space-y-6">
      <Link href="/admin/subscriptions/subscribers" className="text-sm text-berry hover:underline">← Subscribers</Link>
      <PageHeader title={sub.name} lede={`${sub.planName} · requested ${formatDateTime(sub.createdAt)}`}>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_TONE[status]}`}>{SUB_STATUS_LABEL[status]}</span>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="space-y-5 rounded-2xl border border-line bg-white p-5">
          <div>
            <div className="flex items-baseline justify-between">
              <p className="font-display text-3xl tabular">{pr.used} <span className="text-lg text-muted">of {pr.total} meals</span></p>
              <p className="text-sm text-muted">{pr.left} left</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-berry" style={{ width: `${pr.percent}%` }} /></div>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Phone</dt><dd><a href={`tel:+91${sub.phone}`} className="font-medium text-berry">{sub.phone}</a></dd></div>
            <div><dt className="text-muted">Email</dt><dd className="font-medium">{sub.email ?? "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted">Address</dt><dd className="font-medium">{sub.address}{sub.pincode ? `, ${sub.pincode}` : ""}</dd></div>
            <div><dt className="text-muted">Dates</dt><dd className="font-medium">{formatDay(sub.startDate)} – {sub.endDate ? formatDay(sub.endDate) : "—"}</dd></div>
            <div><dt className="text-muted">Delivery days</dt><dd className="font-medium">{daysLabel(sub.deliveryDays)}</dd></div>
            {sub.pausedOn && <div><dt className="text-muted">Paused since</dt><dd className="font-medium">{formatDay(sub.pausedOn)}</dd></div>}
            {sub.notes && <div className="sm:col-span-2"><dt className="text-muted">Customer’s note</dt><dd>“{sub.notes}”</dd></div>}
          </dl>
          <p className="text-xs text-muted">
            Customer’s page: <Link href={`/subscription/${sub.publicToken}`} className="underline" target="_blank">open</Link>. Share it so they can follow their plan.
          </p>
        </section>

        <div className="space-y-6">
          {manage && nextStatuses(status).length > 0 && (
            <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
              <h2 className="font-display text-xl">Status</h2>
              <div className="flex flex-wrap gap-2">
                {nextStatuses(status).map((to) => (
                  <form key={to} action={moveSubscriptionAction}>
                    <input type="hidden" name="id" value={sub.id} />
                    <input type="hidden" name="to" value={to} />
                    <button type="submit" className={to === "active" ? btnPrimary : btnGhost}>{MOVE_LABEL[to]}</button>
                  </form>
                ))}
              </div>
              {status === "pending" && <p className="text-xs text-muted">Activate once you have confirmed with the customer. If the start date has passed, the plan starts today and runs its full length.</p>}
            </section>
          )}

          <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-xl">Payment</h2>
            {sub.paidAt ? (
              <p className="text-sm">
                <span className="font-medium text-veg">Paid</span> {formatINR(sub.pricePaise)} · {formatDateTime(sub.paidAt)}
                {sub.paymentNote ? ` · ${sub.paymentNote}` : ""}
              </p>
            ) : manage ? (
              <form action={markPaidAction} className="space-y-2">
                <p className="text-sm">{formatINR(sub.pricePaise)} not paid yet.</p>
                <input type="hidden" name="id" value={sub.id} />
                <input name="note" placeholder="How it was paid, e.g. UPI ref 4821" className={field} aria-label="Payment note" />
                <button type="submit" className={btnPrimary}>Mark as paid</button>
              </form>
            ) : (
              <p className="text-sm">{formatINR(sub.pricePaise)} not paid yet.</p>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-xl">Team notes</h2>
            <form action={saveStaffNotesAction} className="space-y-2">
              <input type="hidden" name="id" value={sub.id} />
              <textarea name="staffNotes" rows={3} defaultValue={sub.staffNotes ?? ""} className={field} aria-label="Team notes" placeholder="Only your team sees these." />
              <button type="submit" className={btnGhost}>Save notes</button>
            </form>
          </section>
        </div>
      </div>

      <section aria-labelledby="log-h" className="space-y-3">
        <h2 id="log-h" className="font-display text-2xl">Meal log</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-muted">Nothing recorded yet. Meals are marked on the Today tab.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span>{formatDay(d.date)}</span>
                <span className="flex items-center gap-3">
                  <span className={d.status === "delivered" ? "text-veg" : "text-muted"}>{d.status === "delivered" ? "Delivered" : "Skipped"}</span>
                  <form action={undoDeliveryAction}>
                    <input type="hidden" name="id" value={sub.id} />
                    <input type="hidden" name="date" value={d.date} />
                    <button type="submit" className="text-xs text-muted underline hover:text-ink">Undo<span className="sr-only"> {d.date}</span></button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
