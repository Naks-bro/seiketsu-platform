import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { STATUS_LABEL, staffActions } from "@seiketsu/core/order-status";
import { can, requirePage } from "@/lib/server/auth";
import { loadOrder } from "@/lib/server/order-view";
import { formatDateTime, formatINR, whatsappLink } from "@/lib/format";
import { DietMark } from "@/components/diet-mark";
import { StatusActions } from "../status-actions";
import { StatusPill } from "../status-pill";
import { PrintButton, RefundForm } from "./order-tools";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePage(can.manageOrders);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const view = await loadOrder({ id });
  if (!view || view.order.outletId !== staff.outletId) notFound();
  const { order, items, events, payments, refunds } = view;
  const captured = payments.find((p) => p.status === "captured" || p.status === "refunded");
  const refundPending = refunds.some((r) => !["processed", "failed"].includes(r.status));
  const canRefund = !refundPending && can.refund(staff) && (order.status === "rejected" || order.status === "cancelled") && order.paymentState === "paid";
  const wa = whatsappLink(`91${order.customerPhone}`, `Hi ${order.customerName.split(" ")[0]}, this is Seiketsu about your order ${order.orderNumber}.`);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <div className="no-print flex items-center gap-3 text-sm">
          <Link href="/admin/orders" className="text-muted hover:text-ink">← Orders</Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl">{order.orderNumber}</h1>
          <StatusPill status={order.status} />
          <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-semibold capitalize">{order.fulfilment}</span>
          <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-semibold uppercase">{order.source}</span>
          <div className="no-print ml-auto"><PrintButton /></div>
        </div>
        <p className="text-sm text-muted">Placed {formatDateTime(order.placedAt ?? order.createdAt)}</p>

        <div className="no-print">
          <StatusActions orderId={order.id} paid={order.paymentState === "paid"} actions={staffActions(order.status, order.fulfilment).map((a) => ({ to: a.to, needsReason: a.needsReason }))} />
        </div>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Items</h2>
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="flex gap-3 py-3">
                <div className="pt-1"><DietMark diet={i.diet} /></div>
                <div className="flex-1">
                  <p className="text-lg"><span className="font-bold">{i.quantity}×</span> {i.itemName}</p>
                  {i.variantLabel && <p className="text-muted">{i.variantLabel}</p>}
                  {i.addons.map((a) => <p key={a.id} className="text-sm text-muted">+ {a.name} ({formatINR(a.pricePaise)})</p>)}
                  {i.note && <p className="mt-1 rounded bg-butter/60 px-2 py-1 text-sm">“{i.note}”</p>}
                </div>
                <span className="tabular">{formatINR(i.lineTotalPaise)}</span>
              </li>
            ))}
          </ul>
          {order.notes && <p className="mt-3 rounded-lg bg-butter/60 p-3 text-sm"><span className="font-semibold">Order note:</span> {order.notes}</p>}
          <dl className="tabular mt-3 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotalPaise)}</dd></div>
            {order.discountPaise > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatINR(order.discountPaise)}</dd></div>}
            {order.deliveryFeePaise > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatINR(order.deliveryFeePaise)}</dd></div>}
            {order.taxSnapshot.enabled && <div className="flex justify-between"><dt>GST {order.taxSnapshot.rateBps / 100}%{order.taxSnapshot.inclusive ? " incl." : ""}</dt><dd>{formatINR(order.taxPaise)}</dd></div>}
            <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatINR(order.totalPaise)}</dd></div>
          </dl>
        </section>

        <section className="no-print rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">History</h2>
          <ol className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="tabular w-28 shrink-0 text-muted">{formatDateTime(e.createdAt)}</span>
                <span>
                  {STATUS_LABEL[e.toStatus]}
                  <span className="text-muted"> · {e.actorType}</span>
                  {e.note && <span className="block text-muted">{e.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-line bg-white p-5 text-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Customer</h2>
          <p className="text-base font-medium">{order.customerName}</p>
          <p className="tabular">+91 {order.customerPhone}</p>
          {order.customerEmail && <p>{order.customerEmail}</p>}
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="no-print mt-2 inline-block font-semibold text-berry hover:underline">WhatsApp customer</a>}
          {order.address && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="font-medium">Delivery address</p>
              <p>{order.address.line1}</p>
              {order.address.landmark && <p>Near {order.address.landmark}</p>}
              <p>{order.address.pincode}</p>
              {order.address.instructions && <p className="italic text-muted">{order.address.instructions}</p>}
            </div>
          )}
        </section>

        <section className="no-print rounded-2xl border border-line bg-white p-5 text-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Payment</h2>
          <p className="capitalize">{order.paymentState.replace("_", " ")}</p>
          {captured && (
            <p className="text-muted">
              {captured.method ?? "online"} · <span className="break-all">{captured.razorpayPaymentId}</span>
            </p>
          )}
          {payments.filter((p) => p.errorCode).map((p) => (
            <p key={p.id} className="text-nonveg">{p.errorCode}: {p.errorDescription}</p>
          ))}
          {refunds.map((r) => (
            <p key={r.id} className="text-muted">Refund {formatINR(r.amountPaise)} · {r.status}</p>
          ))}
          {order.statusReason && <p className="mt-2">Reason: {order.statusReason}</p>}
          {refundPending && <p role="status" className="mt-2 rounded-lg bg-butter/60 p-3">Refund confirmation is pending. We are checking with the payment provider. Do not issue another refund.</p>}
          {canRefund && <RefundForm orderId={order.id} />}
        </section>
      </aside>
    </div>
  );
}