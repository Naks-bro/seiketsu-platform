import type { Metadata } from "next";
import Link from "next/link";
import { INVOICE_KIND_LABEL, istMonth, istMonthRange, type InvoiceKind } from "@seiketsu/core/invoices";
import { can, requirePage } from "@/lib/server/auth";
import { invoiceRegister } from "@/lib/server/invoices";
import { PageHeader } from "@/components/admin/ui";
import { formatDateTime, formatINR } from "@/lib/format";

export const metadata: Metadata = { title: "Invoices" };

const KINDS: InvoiceKind[] = ["order", "subscription", "credit_note"];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ month?: string; kind?: string }> }) {
  const staff = await requirePage(can.reports);
  const sp = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? sp.month! : istMonth();
  const kind = KINDS.includes(sp.kind as InvoiceKind) ? (sp.kind as InvoiceKind) : undefined;
  const rows = await invoiceRegister(staff.outletId, { ...istMonthRange(month), kind, limit: 2000 });
  const sum = (k: "taxablePaise" | "taxPaise" | "totalPaise") => rows.reduce((s, r) => s + r[k], 0);
  const csv = `/api/admin/invoices?${new URLSearchParams(kind ? { month, kind } : { month })}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" lede="Every order bill, subscription invoice and credit note, numbered in one series per financial year. Credit notes show as negative.">
        <a href={csv} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-paper">Download CSV</a>
      </PageHeader>

      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Month</span>
          <input type="month" name="month" defaultValue={month} className="rounded-lg border border-line px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Type</span>
          <select name="kind" defaultValue={kind ?? ""} className="rounded-lg border border-line px-3 py-2">
            <option value="">All</option>
            {KINDS.map((k) => <option key={k} value={k}>{INVOICE_KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream">Show</button>
      </form>

      <dl className="grid gap-2 sm:grid-cols-4">
        {[
          ["Documents", String(rows.length)],
          ["Taxable value", formatINR(sum("taxablePaise"))],
          ["Tax", formatINR(sum("taxPaise"))],
          ["Total", formatINR(sum("totalPaise"))],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-white p-3">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="tabular text-lg font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">Nothing issued in this month.</p>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Number</th>
                <th scope="col" className="px-3 py-2">Date</th>
                <th scope="col" className="px-3 py-2">Type</th>
                <th scope="col" className="px-3 py-2">Customer</th>
                <th scope="col" className="px-3 py-2 text-right">Taxable</th>
                <th scope="col" className="px-3 py-2 text-right">Tax</th>
                <th scope="col" className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.number}>
                  <td className="px-3 py-2">
                    <Link href={r.href} target="_blank" className="tabular font-medium text-berry hover:underline">{r.number}</Link>
                    {r.againstNumber && <span className="block text-xs text-muted">against {r.againstNumber}</span>}
                  </td>
                  <td className="px-3 py-2 text-muted">{formatDateTime(r.issuedAt)}</td>
                  <td className="px-3 py-2">{INVOICE_KIND_LABEL[r.kind]}</td>
                  <td className="px-3 py-2">
                    {r.customerName}
                    {r.customerPhone && <span className="block text-xs text-muted">{r.customerPhone}</span>}
                  </td>
                  <td className="tabular px-3 py-2 text-right">{formatINR(r.taxablePaise)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatINR(r.taxPaise)}</td>
                  <td className="tabular px-3 py-2 text-right font-medium">{formatINR(r.totalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
