import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadOrder } from "@/lib/server/order-view";
import { orderIssuer } from "@/lib/server/order-view";
import { getStore } from "@/lib/server/catalog";
import { businessLabel } from "@/lib/legal";
import { formatDateTime, formatINR } from "@/lib/format";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Bill", robots: { index: false } };

/**
 * Printable bill. It is a "Tax invoice" only when GST was switched on with a
 * GSTIN at the time of the order (snapshot); otherwise a plain bill of sale.
 */
export default async function BillPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const view = await loadOrder({ token });
  if (!view || !view.order.invoiceNumber) notFound();
  const { order, items, payments } = view;
  const store = orderIssuer(order, await getStore(order.outletId));
  const tax = order.taxSnapshot;
  const isTaxInvoice = tax.enabled && !!tax.gstin;
  const paid = payments.find((p) => p.status === "captured" || p.status === "refunded");
  const halfRate = tax.rateBps / 200;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm sm:px-6">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/order/${order.publicToken}`} className="text-berry hover:underline">← Back to order</Link>
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-line bg-white p-6 sm:p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="font-display text-2xl text-berry">{businessLabel(store.name)}</p>
            {store.addressLines.map((l) => <p key={l} className="text-muted">{l}</p>)}
            {store.phone && <p className="text-muted">Phone {store.phone}</p>}
            {isTaxInvoice && <p className="mt-1 font-medium">GSTIN {tax.gstin}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-lg font-semibold">{isTaxInvoice ? "Tax invoice" : "Bill"}</p>
            <p>No. <span className="tabular font-medium">{order.invoiceNumber}</span></p>
            <p className="text-muted">{formatDateTime(order.placedAt ?? order.createdAt)}</p>
            <p className="text-muted">Order {order.orderNumber}</p>
          </div>
        </header>

        <section className="grid gap-1 border-b border-line py-4">
          <p><span className="text-muted">Billed to</span> {order.customerName} · +91 {order.customerPhone}</p>
          <p className="capitalize"><span className="text-muted">Order type</span> {order.fulfilment}</p>
          {order.fulfilment === "delivery" && order.address && (
            <p><span className="text-muted">Deliver to</span> {order.address.line1}, {order.address.pincode}</p>
          )}
        </section>

        <table className="mt-4 w-full">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Rate</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {items.map((i) => (
              <tr key={i.id} className="border-b border-line/60 align-top">
                <td className="py-2 pr-2">
                  {i.itemName}
                  {i.variantLabel && <span className="text-muted"> · {i.variantLabel}</span>}
                  {i.addons.map((a) => (
                    <span key={a.id} className="block text-xs text-muted">+ {a.name} ({formatINR(a.pricePaise)})</span>
                  ))}
                </td>
                <td className="py-2 text-right">{i.quantity}</td>
                <td className="py-2 text-right">{formatINR(i.unitPricePaise + i.addons.reduce((s, a) => s + a.pricePaise, 0))}</td>
                <td className="py-2 text-right">{formatINR(i.lineTotalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="tabular ml-auto mt-4 w-full max-w-xs space-y-1">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotalPaise)}</dd></div>
          {order.discountPaise > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatINR(order.discountPaise)}</dd></div>}
          {order.deliveryFeePaise > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatINR(order.deliveryFeePaise)}</dd></div>}
          {tax.enabled && order.taxPaise > 0 && (
            <>
              <div className="flex justify-between text-muted"><dt>CGST {halfRate}%{tax.inclusive ? " (incl.)" : ""}</dt><dd>{formatINR(Math.floor(order.taxPaise / 2))}</dd></div>
              <div className="flex justify-between text-muted"><dt>SGST {halfRate}%{tax.inclusive ? " (incl.)" : ""}</dt><dd>{formatINR(Math.ceil(order.taxPaise / 2))}</dd></div>
            </>
          )}
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatINR(order.totalPaise)}</dd></div>
        </dl>

        <footer className="mt-6 border-t border-line pt-4 text-xs text-muted">
          {paid && (
            <p>
              Paid online{paid.method ? ` by ${paid.method}` : ""} · Ref {paid.razorpayPaymentId}
              {order.paymentState === "refunded" ? " · Refunded" : order.paymentState === "partially_refunded" ? " · Partly refunded" : ""}
            </p>
          )}
          {!isTaxInvoice && <p className="mt-1">This is a bill of sale, not a GST tax invoice.</p>}
          <p className="mt-1">Thank you for eating clean with us.</p>
        </footer>
      </article>
    </div>
  );
}