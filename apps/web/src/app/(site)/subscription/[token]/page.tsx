import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { daysLabel, formatDay, progress, SUB_STATUS_LABEL, type SubStatus } from "@seiketsu/core/subscriptions";
import { getStore } from "@/lib/server/catalog";
import { getSubscriptionByToken } from "@/lib/server/subscriptions";
import { formatDateTime, formatINR, whatsappLink } from "@/lib/format";
import { daysBetween, istToday } from "@seiketsu/core/subscriptions";
import { env } from "@/lib/server/env";
import { invoicesForSubscription } from "@/lib/server/invoices";
import { nextPaymentQuote } from "@/lib/server/subscription-payments";
import { SubscriptionPay } from "@/components/site/subscription-pay";

export const metadata: Metadata = { title: "Your subscription", robots: { index: false } };

const EXPLAIN: Record<SubStatus, string> = {
  pending: "We’ve got your request. Pay below to confirm it, or we’ll call you to arrange payment. Meals start on your start date.",
  active: "Your plan is running. Meals arrive on your delivery days.",
  paused: "Your plan is paused. Your end date moves on by the days it stays paused.",
  completed: "All your meals have been delivered. We hope you enjoyed them.",
  cancelled: "This plan has been cancelled.",
};

export default async function SubscriptionPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  await connection();
  const [{ token }, { new: isNew }] = await Promise.all([params, searchParams]);
  const found = await getSubscriptionByToken(token);
  if (!found) notFound();
  const { sub, deliveries } = found;
  const status = sub.status as SubStatus;
  const pr = progress(sub.mealsUsed, sub.mealsTotal);
  const store = await getStore();
  const wa = whatsappLink(store.whatsapp, `Hi Seiketsu, about my ${sub.planName} subscription (${sub.name}).`);
  const [quote, bills] = await Promise.all([nextPaymentQuote(sub), invoicesForSubscription(sub.id)]);
  const online = env.paymentsMode !== "disabled";
  // Renewal shows near the end of a plan, not from day one.
  const nearEnd = status === "completed" || pr.left <= 3 || (!!sub.endDate && daysBetween(istToday(), sub.endDate) <= 7);
  const showPay = !!quote && online && (quote.kind === "first" || nearEnd);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      {isNew && (
        <p role="status" className="rounded-2xl border border-veg/30 bg-veg/5 p-4 text-sm">
          <strong>Thank you, {sub.name.split(" ")[0]}!</strong> Your request is in. Keep this page: it shows your plan’s progress.
        </p>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive-ink">Your subscription</p>
        <h1 className="mt-2 font-display text-4xl text-berry sm:text-5xl">{sub.planName}</h1>
        <p className="mt-3 inline-flex rounded-full bg-paper px-3 py-1 text-sm font-medium">{SUB_STATUS_LABEL[status]}</p>
        <p className="mt-3 max-w-xl text-ink/75">{EXPLAIN[status]}</p>
      </div>

      <section aria-label="Progress" className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-3xl tabular">{pr.used} <span className="text-lg text-muted">of {pr.total} meals</span></p>
          <p className="text-sm text-muted">{pr.left} left</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuemin={0} aria-valuemax={pr.total} aria-valuenow={pr.used} aria-label="Meals delivered">
          <div className="h-full rounded-full bg-berry" style={{ width: `${pr.percent}%` }} />
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Starts</dt><dd className="font-medium">{formatDay(sub.startDate)}</dd></div>
          <div><dt className="text-muted">Runs until</dt><dd className="font-medium">{sub.endDate ? formatDay(sub.endDate) : "—"}</dd></div>
          <div><dt className="text-muted">Delivery days</dt><dd className="font-medium">{daysLabel(sub.deliveryDays)}</dd></div>
          <div><dt className="text-muted">Payment</dt><dd className="font-medium">{formatINR(sub.pricePaise)} · {sub.paidAt ? "paid, thank you" : online ? "not paid yet" : "we’ll confirm with you"}</dd></div>
        </dl>
      </section>

      {showPay && quote && (
        <section aria-labelledby="pay-h" className="space-y-3 rounded-2xl border border-berry/20 bg-white p-5">
          <h2 id="pay-h" className="font-display text-2xl text-berry">{quote.kind === "first" ? "Confirm your plan" : "Keep it going"}</h2>
          <p className="text-sm text-ink/75">
            {quote.kind === "first"
              ? `Pay ${formatINR(quote.amountPaise)} securely with UPI, card or net banking. Your plan is confirmed as soon as the payment goes through.`
              : `Add another ${quote.meals} meal${quote.meals === 1 ? "" : "s"} over ${quote.days} days for ${formatINR(quote.amountPaise)}. Your plan runs on from where it ends.`}
          </p>
          <SubscriptionPay token={sub.publicToken} planName={sub.planName} amountPaise={quote.amountPaise} kind={quote.kind} />
          <p className="text-xs text-muted">Payments are processed by Razorpay. We never see your card details.</p>
        </section>
      )}

      {bills.length > 0 && (
        <section aria-labelledby="bills-h">
          <h2 id="bills-h" className="font-display text-2xl text-berry">Invoices</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white text-sm">
            {bills.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span>
                  <span className="font-medium">{b.kind === "credit_note" ? "Credit note" : "Invoice"} {b.number}</span>
                  <span className="block text-xs text-muted">{formatDateTime(b.issuedAt)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular">{b.kind === "credit_note" ? "−" : ""}{formatINR(b.totalPaise)}</span>
                  <Link href={`/invoice/${b.publicToken}`} className="font-medium text-berry underline">View</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {deliveries.length > 0 && (
        <section aria-labelledby="log-h">
          <h2 id="log-h" className="font-display text-2xl text-berry">Meal log</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white text-sm">
            {deliveries.map((d) => (
              <li key={d.id} className="flex justify-between px-4 py-2.5">
                <span>{formatDay(d.date)}</span>
                <span className={d.status === "delivered" ? "text-veg" : "text-muted"}>{d.status === "delivered" ? "Delivered" : "Skipped"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-muted">
        Need to pause, change something or ask a question?{" "}
        <Link href={`/support?subscription=${sub.publicToken}`} className="font-medium text-berry underline">Send us a request</Link>
        {wa ? <> or <a href={wa} target="_blank" rel="noreferrer" className="font-medium text-berry underline">message us on WhatsApp</a></> : store.phone ? <> or call us on {store.phone}</> : null}.{" "}
        <Link href="/menu" className="font-medium text-berry underline">Browse the menu</Link>
      </p>
    </div>
  );
}
