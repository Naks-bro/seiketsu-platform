import type { Metadata } from "next";
import Link from "next/link";
import { can, requirePage } from "@/lib/server/auth";
import { listCustomers } from "@/lib/server/crm";
import { PageHeader, field } from "@/components/admin/ui";
import { formatDateTime, formatINR } from "@/lib/format";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requirePage(can.reports);
  const { q = "" } = await searchParams;
  const rows = await listCustomers(staff.outletId, q);
  const repeat = rows.filter((r) => r.orders > 1).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" lede="Everyone who has ordered or signed in: what they order, how often, and their points.">
        <a href={`/api/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-paper">Download CSV</a>
      </PageHeader>
      <form className="flex max-w-md gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search customers</label>
        <input id="q" name="q" defaultValue={q} placeholder="Name or phone" className={field} />
        <button type="submit" className="rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-paper">Search</button>
      </form>
      <p className="text-sm text-muted">
        {rows.length} customer{rows.length === 1 ? "" : "s"}{q ? ` matching “${q}”` : ""} · {repeat} ordered more than once
      </p>
      {rows.length > 0 && (
        <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-paper text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Customer</th>
                <th scope="col" className="px-3 py-2">Paid orders</th>
                <th scope="col" className="px-3 py-2">Spent</th>
                <th scope="col" className="px-3 py-2">Last order</th>
                <th scope="col" className="px-3 py-2">Points</th>
                <th scope="col" className="px-3 py-2">Offers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2">
                    <Link href={`/admin/customers/${r.id}`} className="font-medium text-berry hover:underline">{r.name || "No name"}</Link>
                    <span className="block text-muted">{r.phone}</span>
                    {r.tags.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{r.tags.map((t) => <span key={t} className="rounded bg-paper px-1.5 text-xs">{t}</span>)}</span>}
                  </td>
                  <td className="px-3 py-2 tabular">{r.orders}</td>
                  <td className="px-3 py-2 tabular">{formatINR(r.spentPaise)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{r.lastOrderAt ? formatDateTime(new Date(r.lastOrderAt)) : "—"}</td>
                  <td className="px-3 py-2 tabular">{r.points}</td>
                  <td className="px-3 py-2 text-xs text-muted">{[r.marketingWhatsapp && "WhatsApp", r.marketingEmail && "Email"].filter(Boolean).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
