import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SUB_STATUS_LABEL, type SubStatus } from "@seiketsu/core/subscriptions";
import { STATUS_LABEL } from "@seiketsu/core/order-status";
import { can, requirePage } from "@/lib/server/auth";
import { customerDetail } from "@/lib/server/crm";
import { ledgerFor, pointsBalance } from "@/lib/server/rewards";
import { PageHeader, btnGhost, field } from "@/components/admin/ui";
import { formatDateTime, formatINR } from "@/lib/format";
import { adjustPointsAction, saveCustomerNotesAction } from "../../../customer-actions";

export const metadata: Metadata = { title: "Customer" };

const REASON: Record<string, string> = { earn: "Earned", redeem: "Spent", reverse_earn: "Refund: earned points taken back", return_redeem: "Refund: points given back", adjust: "Adjusted" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePage(can.reports);
  const { id } = await params;
  const found = /^[0-9a-f-]{36}$/.test(id) ? await customerDetail(staff.outletId, id) : null;
  if (!found) notFound();
  const { c, history, subs } = found;
  const [balance, ledger] = await Promise.all([pointsBalance(c.id), ledgerFor(c.id)]);
  const paid = history.filter((o) => o.paymentState === "paid" || o.paymentState === "partially_refunded");
  const spent = paid.reduce((a, o) => a + o.totalPaise, 0);

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="text-sm text-berry hover:underline">← Customers</Link>
      <PageHeader title={c.name || "No name"} lede={`+91 ${c.phone}${c.email ? ` · ${c.email}` : ""} · first seen ${formatDateTime(c.createdAt)}`} />

      <ul className="grid gap-3 sm:grid-cols-4">
        {[
          ["Paid orders", String(paid.length)],
          ["Spent", formatINR(spent)],
          ["Average order", paid.length ? formatINR(Math.round(spent / paid.length)) : "—"],
          ["Points", String(balance)],
        ].map(([k, v]) => (
          <li key={k} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-sm text-muted">{k}</p>
            <p className="font-display text-2xl tabular">{v}</p>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="orders-h" className="space-y-3">
          <h2 id="orders-h" className="font-display text-2xl">Orders</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
              {history.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-paper">
                    <span>
                      <span className="font-medium">{o.orderNumber}</span>
                      <span className="block text-muted">{formatDateTime(o.createdAt)}{o.couponCode ? ` · ${o.couponCode}` : ""}</span>
                    </span>
                    <span className="text-right">
                      <span className="tabular font-medium">{formatINR(o.totalPaise)}</span>
                      <span className="block text-muted">{STATUS_LABEL[o.status]}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {subs.length > 0 && (
            <>
              <h2 className="pt-3 font-display text-2xl">Subscriptions</h2>
              <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
                {subs.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/subscriptions/subscribers/${s.id}`} className="flex justify-between px-4 py-2.5 hover:bg-paper">
                      <span className="font-medium">{s.planName}</span>
                      <span className="text-muted">{SUB_STATUS_LABEL[s.status as SubStatus]} · {s.mealsUsed}/{s.mealsTotal}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <div className="space-y-6">
          <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-xl">Notes &amp; tags</h2>
            <form action={saveCustomerNotesAction} className="space-y-2">
              <input type="hidden" name="id" value={c.id} />
              <label className="block text-sm"><span className="font-medium">Tags</span>
                <input name="tags" defaultValue={c.tags.join(", ")} placeholder="office, regular, no onion" className={`${field} mt-1`} />
              </label>
              <label className="block text-sm"><span className="font-medium">Notes</span>
                <textarea name="notes" rows={3} defaultValue={c.notes ?? ""} className={`${field} mt-1`} placeholder="Only your team sees these." />
              </label>
              <button type="submit" className={btnGhost}>Save</button>
            </form>
          </section>

          <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-xl">Points · {balance}</h2>
            <form action={adjustPointsAction} className="grid grid-cols-[6rem_1fr] gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="points" type="number" required placeholder="+50" aria-label="Points to add (use minus to remove)" className={field} />
              <input name="note" required minLength={2} placeholder="Why, e.g. late delivery" aria-label="Reason" className={field} />
              <button type="submit" className={`${btnGhost} col-span-2`}>Adjust points</button>
            </form>
            {ledger.length > 0 && (
              <ul className="divide-y divide-line text-sm">
                {ledger.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 py-1.5">
                    <span>{REASON[l.reason] ?? l.reason}{l.note ? ` · ${l.note}` : ""}<span className="block text-xs text-muted">{formatDateTime(l.createdAt)}</span></span>
                    <span className={`tabular font-medium ${l.points > 0 ? "text-veg" : "text-nonveg"}`}>{l.points > 0 ? `+${l.points}` : l.points}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
