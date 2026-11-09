import type { Metadata } from "next";
import Link from "next/link";
import { formatQty } from "@seiketsu/core/inventory";
import { requireStaff } from "@/lib/server/auth";
import { recentMovements, usageSummary } from "@/lib/server/inventory";
import { parseRange } from "@/lib/server/reports";
import { formatINR } from "@/lib/format";
import { btnGhost, field, PageHeader, panel } from "@/components/admin/ui";
import { MovementTable } from "../movement-table";

export const metadata: Metadata = { title: "Usage & history" };

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
];

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const range = parseRange(sp.range || sp.from ? sp : { range: "7d" });
  const [rows, moves] = await Promise.all([
    usageSummary(staff.outletId, range.from, range.to),
    recentMovements(staff.outletId, { from: range.from, to: range.to, limit: 300 }),
  ]);
  const used = rows.reduce((s, r) => s + r.usedPaise, 0);
  const wasted = rows.reduce((s, r) => s + r.wastedPaise, 0);
  const spent = rows.reduce((s, r) => s + r.spentPaise, 0);

  return (
    <>
      <PageHeader title="Usage & history" lede={`${range.label} (India time). Costs use the average delivery price at the time.`} />
      <div className="flex flex-wrap items-end gap-2">
        <nav aria-label="Date range" className="flex flex-wrap gap-2">
          {RANGES.map((x) => (
            <Link
              key={x.key}
              href={`/admin/inventory/history?range=${x.key}`}
              aria-current={range.key === x.key ? "page" : undefined}
              className={`min-h-10 rounded-full border px-4 py-2 text-sm ${range.key === x.key ? "border-berry bg-berry text-cream" : "border-line bg-white hover:border-berry"}`}
            >
              {x.label}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap items-end gap-2 text-sm" action="/admin/inventory/history">
          <label className="space-y-1">From<input type="date" name="from" defaultValue={range.fromDay} className={field} /></label>
          <label className="space-y-1">To<input type="date" name="to" defaultValue={range.toDay} className={field} /></label>
          <button type="submit" className={btnGhost}>Show</button>
        </form>
      </div>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Totals">
        {[
          { label: "Used in sales", value: used, sub: "ingredient cost of what was sold" },
          { label: "Wasted", value: wasted, sub: used + wasted > 0 ? `${Math.round((wasted / (used + wasted)) * 100)}% of all stock used` : "" },
          { label: "Spent on deliveries", value: spent, sub: "bill totals entered" },
        ].map((s) => (
          <div key={s.label} className={panel}>
            <p className="text-xs font-semibold text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatINR(Math.round(s.value))}</p>
            {s.sub && <p className="text-xs text-muted">{s.sub}</p>}
          </div>
        ))}
      </section>

      <section aria-labelledby="by-ing">
        <h2 id="by-ing" className="mb-2 font-display text-2xl">By ingredient</h2>
        {rows.length === 0 ? (
          <p className={`${panel} text-sm text-muted`}>No stock movements in this period.</p>
        ) : (
          <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-paper text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Ingredient</th>
                  <th scope="col" className="px-3 py-2 text-right">Used in sales</th>
                  <th scope="col" className="px-3 py-2 text-right">Wasted</th>
                  <th scope="col" className="px-3 py-2 text-right">Received</th>
                  <th scope="col" className="px-3 py-2 text-right">Spent</th>
                  <th scope="col" className="px-3 py-2 text-right">Count difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.ingredientId}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      <Link href={`/admin/inventory/${r.ingredientId}`} className="hover:text-berry hover:underline">{r.name}</Link>
                    </th>
                    <td className="tabular px-3 py-2 text-right">{r.usedMilli ? `${formatQty(r.usedMilli, r.unit)} · ${formatINR(Math.round(r.usedPaise))}` : "–"}</td>
                    <td className="tabular px-3 py-2 text-right">{r.wastedMilli ? `${formatQty(r.wastedMilli, r.unit)} · ${formatINR(Math.round(r.wastedPaise))}` : "–"}</td>
                    <td className="tabular px-3 py-2 text-right">{r.receivedMilli ? formatQty(r.receivedMilli, r.unit) : "–"}</td>
                    <td className="tabular px-3 py-2 text-right">{r.spentPaise ? formatINR(r.spentPaise) : "–"}</td>
                    <td className="tabular px-3 py-2 text-right">{r.countDiffMilli ? `${r.countDiffMilli > 0 ? "+" : ""}${formatQty(r.countDiffMilli, r.unit)}` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">Count difference: what shelf counts found compared with what the system expected. A negative number usually means use or wastage that was not recorded.</p>
      </section>

      <section aria-labelledby="log-h">
        <h2 id="log-h" className="mb-2 font-display text-2xl">Every movement</h2>
        <MovementTable rows={moves} />
        {moves.length === 300 && <p className="mt-2 text-xs text-muted">Showing the latest 300. Pick a shorter period to see older ones.</p>}
      </section>
    </>
  );
}
