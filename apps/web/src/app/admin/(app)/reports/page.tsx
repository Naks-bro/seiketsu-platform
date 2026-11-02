import type { Metadata } from "next";
import Link from "next/link";
import { can, requireStaff } from "@/lib/server/auth";
import { parseRange, salesReport } from "@/lib/server/reports";
import { formatINR } from "@/lib/format";
import { btnGhost, field, PageHeader, panel } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Reports" };

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
];
const PAY_LABEL: Record<string, string> = { razorpay: "Online (Razorpay)", cash: "Cash at counter", counter_upi: "UPI at counter", counter_card: "Card at counter" };
const SOURCE_LABEL: Record<string, string> = { web: "Website", qr: "Table QR", pos: "Counter", staff: "Staff" };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

/** A table row with a proportional bar behind the number, so the shape is visible without a chart library. */
function BarRow({ label, value, max, right }: { label: string; value: number; max: number; right: string }) {
  const pct = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <tr className="border-t border-line">
      <th scope="row" className="py-1.5 pr-3 text-left font-normal">{label}</th>
      <td className="w-1/2 py-1.5">
        <div className="h-2.5 rounded-full bg-paper" aria-hidden>
          <div className="h-2.5 rounded-full bg-berry" style={{ width: `${pct}%` }} />
        </div>
      </td>
      <td className="whitespace-nowrap py-1.5 pl-3 text-right tabular-nums">{right}</td>
    </tr>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const staff = await requireStaff();
  if (!can.reports(staff)) return <p className="text-muted">Reports are for owners and managers.</p>;
  const sp = await searchParams;
  const range = parseRange(sp);
  const r = await salesReport(staff.outletId, range);
  const qs = range.key === "custom" ? `from=${range.fromDay}&to=${range.toDay}` : `range=${range.key}`;
  const maxHour = Math.max(0, ...r.byHour.map((h) => h.amount));
  const maxItem = Math.max(0, ...r.bestSellers.map((b) => b.qty));
  const maxDay = Math.max(0, ...r.byDay.map((d) => d.amount));
  const fees = r.byPayment.reduce((s, p) => s + p.fees, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" lede={`Paid orders only. ${range.label} (India time).`}>
        <a href={`/api/admin/reports/export?${qs}`} className={btnGhost} download>Download CSV (Excel)</a>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-2">
        <nav aria-label="Date range" className="flex flex-wrap gap-2">
          {RANGES.map((x) => (
            <Link
              key={x.key}
              href={`/admin/reports?range=${x.key}`}
              aria-current={range.key === x.key ? "page" : undefined}
              className={`min-h-10 rounded-full border px-4 py-2 text-sm ${range.key === x.key ? "border-berry bg-berry text-cream" : "border-line bg-white hover:border-berry"}`}
            >
              {x.label}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap items-end gap-2 text-sm" action="/admin/reports">
          <label className="space-y-1">From<input type="date" name="from" defaultValue={range.fromDay} className={field} /></label>
          <label className="space-y-1">To<input type="date" name="to" defaultValue={range.toDay} className={field} /></label>
          <button type="submit" className={btnGhost}>Show</button>
        </form>
      </div>

      {r.totals.orders === 0 ? (
        <p className={`${panel} text-muted`}>No paid orders in this period yet.</p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totals">
            <Stat label="Sales" value={formatINR(r.totals.gross)} sub={`${r.totals.orders} orders`} />
            <Stat label="After refunds" value={formatINR(r.totals.net)} sub={r.totals.refunds ? `${formatINR(r.totals.refunds)} refunded` : "No refunds"} />
            <Stat label="Average order" value={formatINR(r.totals.average)} />
            <Stat label="GST collected" value={formatINR(r.totals.tax)} sub={fees ? `Razorpay fees ${formatINR(fees)}` : undefined} />
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className={panel}>
              <h2 className="mb-2 font-display text-xl">How customers paid</h2>
              <table className="w-full text-sm">
                <tbody>
                  {r.byPayment.map((p) => (
                    <BarRow key={p.provider} label={PAY_LABEL[p.provider] ?? p.provider} value={p.amount} max={r.totals.gross} right={`${formatINR(p.amount)} · ${p.orders}`} />
                  ))}
                </tbody>
              </table>
              <h2 className="mb-2 mt-5 font-display text-xl">Where orders came from</h2>
              <table className="w-full text-sm">
                <tbody>
                  {r.bySource.map((s) => (
                    <BarRow key={s.source} label={SOURCE_LABEL[s.source] ?? s.source} value={s.amount} max={r.totals.gross} right={`${formatINR(s.amount)} · ${s.orders}`} />
                  ))}
                </tbody>
              </table>
            </section>

            <section className={panel}>
              <h2 className="mb-2 font-display text-xl">Best sellers</h2>
              <table className="w-full text-sm">
                <caption className="sr-only">Dishes by quantity sold</caption>
                <tbody>
                  {r.bestSellers.map((b) => (
                    <BarRow key={b.name} label={b.name} value={b.qty} max={maxItem} right={`${b.qty} · ${formatINR(b.amount)}`} />
                  ))}
                </tbody>
              </table>
            </section>

            <section className={panel}>
              <h2 className="mb-2 font-display text-xl">Busy hours</h2>
              <table className="w-full text-sm">
                <caption className="sr-only">Sales by hour of day</caption>
                <tbody>
                  {r.byHour.map((h) => (
                    <BarRow key={h.hour} label={`${String(h.hour).padStart(2, "0")}:00`} value={h.amount} max={maxHour} right={`${formatINR(h.amount)} · ${h.orders}`} />
                  ))}
                </tbody>
              </table>
            </section>

            {r.byDay.length > 1 && (
              <section className={panel}>
                <h2 className="mb-2 font-display text-xl">By day</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {r.byDay.map((d) => (
                      <BarRow key={d.day} label={d.day} value={d.amount} max={maxDay} right={`${formatINR(d.amount)} · ${d.orders}`} />
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}