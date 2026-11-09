import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { invoiceByToken } from "@/lib/server/invoices";
import { businessLabel } from "@/lib/legal";
import { formatDateTime, formatINR } from "@/lib/format";
import { PrintButton } from "../../bill/[token]/print-button";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };

/**
 * Printable subscription invoice or credit note. It is a "Tax invoice" only when
 * GST was switched on with a GSTIN when it was issued (snapshot); otherwise a plain invoice.
 */
export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const inv = await invoiceByToken(token);
  if (!inv) notFound();
  const tax = inv.taxSnapshot;
  const gst = tax.enabled && !!tax.gstin;
  const credit = inv.kind === "credit_note";
  const title = credit ? (gst ? "Credit note (GST)" : "Credit note") : gst ? "Tax invoice" : "Invoice";
  const halfRate = tax.rateBps / 200;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm sm:px-6">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>
      <article className="rounded-2xl border border-line bg-white p-6 sm:p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="font-display text-2xl text-berry">{businessLabel(inv.issuer.name)}</p>
            {inv.issuer.addressLines.map((l) => <p key={l} className="text-muted">{l}</p>)}
            {inv.issuer.phone && <p className="text-muted">Phone {inv.issuer.phone}</p>}
            {gst && <p className="mt-1 font-medium">GSTIN {tax.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{title}</p>
            <p>No. <span className="tabular font-medium">{inv.number}</span></p>
            <p className="text-muted">{formatDateTime(inv.issuedAt)}</p>
            {inv.againstNumber && <p className="text-muted">Against {inv.againstNumber}</p>}
          </div>
        </header>

        <section className="grid gap-1 border-b border-line py-4">
          <p><span className="text-muted">Billed to</span> {inv.customerName}{inv.customerPhone ? ` · +91 ${inv.customerPhone}` : ""}</p>
          {inv.billingAddress && <p><span className="text-muted">Address</span> {inv.billingAddress}</p>}
        </section>

        <table className="mt-4 w-full">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 pl-3 text-right font-medium">Qty</th>
              <th className="py-2 pl-4 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {inv.lines.map((l, i) => (
              <tr key={i} className="border-b border-line/60 align-top">
                <td className="py-2 pr-2">
                  {l.label}
                  {l.detail && <span className="block text-xs text-muted">{l.detail}</span>}
                </td>
                <td className="py-2 pl-3 text-right">{l.quantity}</td>
                <td className="py-2 pl-4 text-right">{formatINR(l.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="tabular ml-auto mt-4 w-full max-w-xs space-y-1">
          <div className="flex justify-between"><dt>{tax.enabled && inv.taxPaise > 0 ? "Taxable value" : "Subtotal"}</dt><dd>{formatINR(inv.taxablePaise)}</dd></div>
          {tax.enabled && inv.taxPaise > 0 && (
            <>
              <div className="flex justify-between text-muted"><dt>CGST {halfRate}%</dt><dd>{formatINR(Math.floor(inv.taxPaise / 2))}</dd></div>
              <div className="flex justify-between text-muted"><dt>SGST {halfRate}%</dt><dd>{formatINR(Math.ceil(inv.taxPaise / 2))}</dd></div>
            </>
          )}
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>{credit ? "Credited" : "Total"}</dt><dd>{formatINR(inv.totalPaise)}</dd></div>
        </dl>

        <footer className="mt-6 border-t border-line pt-4 text-xs text-muted">
          {!credit && inv.paymentMethod && <p>Paid · {inv.paymentMethod}</p>}
          {credit && <p>This credit note reduces invoice {inv.againstNumber}. The amount is refunded to the original payment method.</p>}
          {!gst && <p className="mt-1">{credit ? "Not a GST credit note." : "This is an invoice of sale, not a GST tax invoice."}</p>}
          <p className="mt-1">Thank you for eating clean with us.</p>
        </footer>
      </article>
    </div>
  );
}
