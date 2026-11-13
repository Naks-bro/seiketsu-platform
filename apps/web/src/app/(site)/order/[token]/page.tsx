import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { STATUS_LABEL, type OrderStatus } from "@seiketsu/core/order-status";
import { getStore } from "@/lib/server/catalog";
import { loadOrder } from "@/lib/server/order-view";
import { reconcileOrder } from "@/lib/server/orders";
import { env } from "@/lib/server/env";
import { formatDateTime, formatINR, formatTimeOnly, whatsappLink } from "@/lib/format";
import { DietMark } from "@/components/diet-mark";
import { LiveRefresh, PayNow } from "@/components/site/order-live";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

const PICKUP_STEPS: OrderStatus[] = ["placed", "accepted", "preparing", "ready", "completed"];
const DELIVERY_STEPS: OrderStatus[] = ["placed", "accepted", "preparing", "ready", "out_for_delivery", "completed"];

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  let view = await loadOrder({ token });
  if (!view) notFound();
  const fresh = await reconcileOrder(view.order);
  if (fresh.status !== view.order.status) view = (await loadOrder({ token }))!;
  const { order, items, events } = view;
  const store = await getStore();

  const steps = order.fulfilment === "delivery" ? DELIVERY_STEPS : PICKUP_STEPS;
  const currentIdx = steps.indexOf(order.status);
  const reached = new Map(events.map((e) => [e.toStatus, e.createdAt]));
  const unpaid = order.status === "pending_payment" || order.status === "payment_failed";
  const ended = order.status === "rejected" || order.status === "cancelled" || order.status === "expired";
  const trackUrl = `${env.siteUrl}/order/${token}`;
  const updates = env.whatsapp.loginNumber && !ended && order.status !== "completed" ? `https://wa.me/${env.whatsapp.loginNumber}?text=${encodeURIComponent(`Track ${order.orderNumber}`)}` : null;
  const wa = whatsappLink(store.whatsapp, `Hi Seiketsu, this is about my order ${order.orderNumber}. ${trackUrl}`);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
      <LiveRefresh token={token} status={order.status} />
      <p className="text-sm font-semibold text-olive-ink">
        Order {order.orderNumber} · {formatDateTime(order.createdAt)}
      </p>
      <h1 className="mt-2 font-display text-4xl text-berry sm:text-5xl">
        {unpaid ? "Payment not completed" : ended ? STATUS_LABEL[order.status] : order.status === "completed" ? "Enjoy your meal!" : "Thank you, " + order.customerName.split(" ")[0] + "."}
      </h1>

      {unpaid && (
        <div className="mt-6 space-y-3 rounded-2xl bg-butter/60 p-5">
          <p>
            We have saved your order but have not received payment yet.
            {order.status === "payment_failed" && " The last attempt did not go through."} Your order goes to the kitchen as soon as payment is confirmed.
          </p>
          <PayNow token={token} orderNumber={order.orderNumber} totalPaise={order.totalPaise} />
        </div>
      )}

      {order.status === "expired" && (
        <div className="mt-6 space-y-3 rounded-2xl bg-paper p-5">
          <p>This order expired before payment was completed. No money was taken. If you were charged, we will match it automatically or refund it.</p>
          <Link href="/menu" className="inline-block rounded-full bg-berry px-5 py-2.5 font-semibold text-cream">Start a new order</Link>
        </div>
      )}

      {(order.status === "rejected" || order.status === "cancelled") && (
        <div className="mt-6 space-y-2 rounded-2xl bg-paper p-5">
          {order.statusReason && <p>Reason: {order.statusReason}</p>}
          <p className="text-sm text-muted">
            {order.paymentState === "refunded"
              ? "Your payment has been refunded. It usually reaches your account in 5 to 7 working days."
              : order.paymentState === "paid"
                ? "Your refund is being processed. We will message you if we need anything."
                : ""}
          </p>
        </div>
      )}

      {updates && !unpaid && (
        <a href={updates} target="_blank" rel="noreferrer" className="mt-6 flex items-center gap-3 rounded-2xl border border-olive/40 bg-paper p-4 hover:bg-butter/40">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#25D366] text-white" aria-hidden>
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" /></svg>
          </span>
          <span className="text-sm">
            <span className="block font-semibold text-ink">Get live updates on WhatsApp</span>
            <span className="text-muted">Tap, then send the message. We&rsquo;ll tell you the moment it&rsquo;s ready.</span>
          </span>
        </a>
      )}

      {!unpaid && !ended && (
        <ol className="mt-8 space-y-0" aria-label="Order progress">
          {steps.map((s, i) => {
            const done = i <= currentIdx;
            const at = reached.get(s);
            return (
              <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
                {i < steps.length - 1 && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${i < currentIdx ? "bg-berry" : "bg-line"}`} aria-hidden />}
                <span className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 ${done ? "border-berry bg-berry" : "border-line bg-cream"}`}>
                  {done && <span className="size-2 rounded-full bg-cream" />}
                </span>
                <div className={done ? "" : "text-muted"}>
                  <p className={`font-medium ${i === currentIdx ? "text-berry" : ""}`}>
                    {s === "ready" && order.fulfilment === "pickup" ? "Ready for pickup" : STATUS_LABEL[s]}
                  </p>
                  {at && <p className="tabular text-sm text-muted">{formatTimeOnly(at)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <section className="mt-10 rounded-2xl border border-line bg-white/70 p-5">
        <h2 className="mb-3 font-display text-2xl">Your order</h2>
        <ul className="divide-y divide-line text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex gap-2 py-2.5">
              <div className="pt-0.5"><DietMark diet={i.diet} size={12} /></div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{i.quantity} × {i.itemName}</p>
                {i.variantLabel && <p className="text-muted">{i.variantLabel}</p>}
                {i.addons.length > 0 && <p className="text-muted">+ {i.addons.map((a) => a.name).join(", ")}</p>}
                {i.note && <p className="italic text-muted">“{i.note}”</p>}
              </div>
              <span className="tabular">{formatINR(i.lineTotalPaise)}</span>
            </li>
          ))}
        </ul>
        <dl className="tabular mt-2 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotalPaise)}</dd></div>
          {order.deliveryFeePaise > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatINR(order.deliveryFeePaise)}</dd></div>}
          {order.taxSnapshot.enabled && order.taxSnapshot.gstin && (
            <div className="flex justify-between text-muted"><dt>GST{order.taxSnapshot.inclusive ? " (included)" : ""}</dt><dd>{formatINR(order.taxPaise)}</dd></div>
          )}
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatINR(order.totalPaise)}</dd></div>
          <div className="flex justify-between text-muted">
            <dt>Payment</dt>
            <dd className="capitalize">{order.paymentState.replace("_", " ")}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line p-5 text-sm">
          <h2 className="mb-2 text-sm font-semibold text-olive-ink">
            {order.fulfilment === "pickup" ? "Pickup from" : "Delivering to"}
          </h2>
          {order.fulfilment === "pickup" ? (
            <>
              <p>{store.addressLines.join(", ")}</p>
              <a href={store.mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-berry hover:underline">Directions</a>
            </>
          ) : (
            <p>
              {order.address?.line1}
              {order.address?.landmark ? `, near ${order.address.landmark}` : ""}, {order.address?.pincode}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-line p-5 text-sm">
          <h2 className="mb-2 text-sm font-semibold text-olive-ink">Questions?</h2>
          <p className="mb-3">Something not right? Tell us and we’ll sort it out.</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/support?order=${order.publicToken}`} className="inline-block rounded-full bg-berry px-4 py-2 font-semibold text-cream hover:bg-berry-deep">
              Get help with this order
            </Link>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="inline-block rounded-full border border-olive px-4 py-2 font-semibold text-olive-ink hover:bg-paper">
                WhatsApp us
              </a>
            )}
          </div>
        </div>
      </section>
      {order.invoiceNumber && (
        <p className="mt-6">
          <Link href={`/bill/${order.publicToken}`} className="inline-block rounded-full border border-berry/30 px-5 py-2 text-sm font-semibold text-berry hover:bg-paper">
            View or download bill
          </Link>
        </p>
      )}
      <p className="mt-6 text-xs text-muted">Bookmark this page to check your order. Anyone with this link can see the order status.</p>
    </div>
  );
}