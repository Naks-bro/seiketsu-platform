import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadOrder } from "@/lib/server/order-view";
import { orderIssuer } from "@/lib/server/order-view";
import { getStore } from "@/lib/server/catalog";
import { env } from "@/lib/server/env";
import { businessLabel, LEGAL } from "@/lib/legal";
import { rupeesInWords } from "@/lib/amount-words";
import { formatBillDate, formatINR } from "@/lib/format";
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
  const site = env.siteUrl.replace(/^https?:\/\//, "");
  const paidLabel = order.paymentState === "refunded" ? "Refunded" : order.paymentState === "partially_refunded" ? "Partly refunded" : paid ? "Paid" : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-sm sm:px-6 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/order/${order.publicToken}`} className="text-berry hover:underline">Back to order</Link>
        <PrintButton />
      </div>

      <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)] print:rounded-none print:border-0 print:shadow-none" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <header className="flex flex-wrap items-center justify-between gap-4 bg-berry px-6 py-5 text-cream sm:px-8">
          <Image src="/brand/wordmark-cream.png" alt="Seiketsu" width={126} height={20} className="h-7 w-auto" priority />
          <div className="text-right">
            <p className="text-lg font-semibold tracking-wide">{isTaxInvoice ? "Tax invoice" : "Bill of sale"}</p>
            <p className="tabular text-cream/90">{order.invoiceNumber}</p>
          </div>
        </header>

        <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 sm:px-8">
          <section>
            <p className="text-xs font-semibold text-muted">From</p>
            <p className="mt-1 font-semibold text-ink">{businessLabel(store.name)}</p>
            {store.addressLines.map((l) => <p key={l} className="text-ink/80">{l}</p>)}
            {store.phone && <p className="text-ink/80">Phone {store.phone}</p>}
            {isTaxInvoice && <p className="mt-1 font-medium">GSTIN {tax.gstin}</p>}
            <p className="text-ink/80">{LEGAL.fssaiLabel} {LEGAL.fssai}</p>
          </section>
          <section className="sm:text-right">
            <p className="text-xs font-semibold text-muted">Billed to</p>
            <p className="mt-1 font-semibold text-ink">{order.customerName}</p>
            <p className="text-ink/80">+91 {order.customerPhone}</p>
            {order.fulfilment === "delivery" && order.address && <p className="text-ink/80">{order.address.line1}, {order.address.pincode}</p>}
          </section>
        </div>

        <dl className="mx-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:mx-8 sm:grid-cols-4">
          {[
            ["Date", formatBillDate(order.placedAt ?? order.createdAt)],
            ["Order", order.orderNumber],
            ["Type", order.fulfilment === "delivery" ? "Delivery" : order.fulfilment === "pickup" ? "Pickup" : "Dine in"],
            ["Payment", paidLabel ?? "Pending"],
          ].map(([k, v]) => (
            <div key={k} className="bg-paper px-3 py-2.5">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="tabular font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="px-6 pt-6 sm:px-8">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-ink text-left text-xs text-muted">
                <th className="w-8 py-2 font-medium">#</th>
                <th className="py-2 font-medium">Item</th>
                <th className="w-12 py-2 pl-3 text-right font-medium">Qty</th>
                <th className="w-24 py-2 pl-3 text-right font-medium">Rate</th>
                <th className="w-24 py-2 pl-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {items.map((i, n) => (
                <tr key={i.id} className="border-b border-line align-top">
                  <td className="py-2.5 text-muted">{n + 1}</td>
                  <td className="py-2.5 pr-2">
                    <span className="font-medium text-ink">{i.itemName}</span>
                    {i.variantLabel && <span className="text-muted">, {i.variantLabel}</span>}
                    {i.addons.map((a) => (
                      <span key={a.id} className="block text-xs text-muted">+ {a.name} ({formatINR(a.pricePaise)})</span>
                    ))}
                  </td>
                  <td className="py-2.5 pl-3 text-right">{i.quantity}</td>
                  <td className="py-2.5 pl-3 text-right">{formatINR(i.unitPricePaise + i.addons.reduce((s, a) => s + a.pricePaise, 0))}</td>
                  <td className="py-2.5 pl-3 text-right font-medium">{formatINR(i.lineTotalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 px-6 py-6 sm:grid-cols-[1fr_minmax(0,18rem)] sm:px-8">
          <div className="self-end">
            <p className="text-xs text-muted">Amount in words</p>
            <p className="font-medium text-ink">{rupeesInWords(order.totalPaise)}</p>
          </div>
          <dl className="tabular space-y-1.5 rounded-xl bg-paper p-4">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotalPaise)}</dd></div>
            {order.discountPaise > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatINR(order.discountPaise)}</dd></div>}
            {order.deliveryFeePaise > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatINR(order.deliveryFeePaise)}</dd></div>}
            {isTaxInvoice && order.taxPaise > 0 && (
              <>
                <div className="flex justify-between text-ink/80"><dt>CGST {halfRate}%{tax.inclusive ? " (incl.)" : ""}</dt><dd>{formatINR(Math.floor(order.taxPaise / 2))}</dd></div>
                <div className="flex justify-between text-ink/80"><dt>SGST {halfRate}%{tax.inclusive ? " (incl.)" : ""}</dt><dd>{formatINR(Math.ceil(order.taxPaise / 2))}</dd></div>
              </>
            )}
            <div className="flex justify-between border-t border-ink/20 pt-2 text-lg font-semibold text-berry"><dt>Total</dt><dd>{formatINR(order.totalPaise)}</dd></div>
          </dl>
        </div>

        <footer className="border-t border-line bg-paper px-6 py-4 text-xs text-ink/80 sm:px-8">
          {paid && (
            <p>
              Paid online{paid.method ? ` by ${paid.method}` : ""}, reference <span className="tabular">{paid.razorpayPaymentId}</span>
            </p>
          )}
          {!isTaxInvoice && <p className="mt-1">This is a bill of sale, not a GST tax invoice.</p>}
          <p className="mt-1 flex flex-wrap justify-between gap-2">
            <span>Thank you for eating clean with us.</span>
            <span>{site}{store.instagram ? `  ·  @${store.instagram}` : ""}</span>
          </p>
        </footer>
      </article>
    </div>
  );
}
