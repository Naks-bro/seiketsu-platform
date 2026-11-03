import type { Metadata } from "next";
import Link from "next/link";
import { formatDay, progress, SUB_STATUS_LABEL, SUB_STATUSES, type SubStatus } from "@seiketsu/core/subscriptions";
import { can, requirePage } from "@/lib/server/auth";
import { listSubscribers } from "@/lib/server/subscriptions";
import { PageHeader } from "@/components/admin/ui";
import { formatINR } from "@/lib/format";
import { STATUS_TONE, SubTabs } from "../tabs";

export const metadata: Metadata = { title: "Subscribers" };

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const staff = await requirePage(can.manageOrders);
  const { status } = await searchParams;
  const filter = (SUB_STATUSES as readonly string[]).includes(status ?? "") ? (status as SubStatus) : undefined;
  const rows = await listSubscribers(staff.outletId, filter);
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 ${on ? "border-berry bg-berry text-cream" : "border-line bg-white hover:bg-paper"}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Subscribers" lede="Everyone who has asked for or bought a plan.">
        <SubTabs current="subscribers" />
      </PageHeader>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/subscriptions/subscribers" aria-current={!filter ? "page" : undefined} className={chip(!filter)}>All</Link>
        {SUB_STATUSES.map((st) => (
          <Link key={st} href={`/admin/subscriptions/subscribers?status=${st}`} aria-current={filter === st ? "page" : undefined} className={chip(filter === st)}>
            {SUB_STATUS_LABEL[st]}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">No subscribers here yet.</p>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Subscriber</th>
                <th scope="col" className="px-3 py-2">Plan</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2">Dates</th>
                <th scope="col" className="px-3 py-2">Meals</th>
                <th scope="col" className="px-3 py-2">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const pr = progress(r.mealsUsed, r.mealsTotal);
                return (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2">
                      <Link href={`/admin/subscriptions/subscribers/${r.id}`} className="font-medium text-berry hover:underline">{r.name}</Link>
                      <span className="block text-muted">{r.phone}</span>
                    </td>
                    <td className="px-3 py-2">{r.planName}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[r.status]}`}>{SUB_STATUS_LABEL[r.status as SubStatus]}</span></td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDay(r.startDate)}{r.endDate ? ` – ${formatDay(r.endDate)}` : ""}</td>
                    <td className="px-3 py-2 tabular">{pr.used}/{pr.total}</td>
                    <td className="px-3 py-2">{r.paidAt ? <span className="text-veg">Paid</span> : <span className="text-berry">{formatINR(r.pricePaise)} due</span>}</td>
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
