import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { desc, eq, ne, and } from "drizzle-orm";
import { getDb, orders } from "@seiketsu/db";
import { STATUS_LABEL } from "@seiketsu/core/order-status";
import { getCustomer } from "@/lib/server/customer-auth";
import { subscriptionsForPhone } from "@/lib/server/subscriptions";
import { ticketsForPhone } from "@/lib/server/tickets";
import { CUSTOMER_STATUS_LABEL, type TicketStatus } from "@seiketsu/core/tickets";
import { loyaltySettings, pointsForPhone } from "@/lib/server/rewards";
import { getStore } from "@/lib/server/catalog";
import { progress, SUB_STATUS_LABEL, type SubStatus } from "@seiketsu/core/subscriptions";
import { env } from "@/lib/server/env";
import { formatDateTime, formatINR } from "@/lib/format";
import { PhoneLogin } from "./phone-login";
import { ProfileForm } from "./profile-form";
import { customerLogoutAction, setConsentAction } from "./actions";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

function ConsentRow({ channel, label, on, disabled, hint }: { channel: "whatsapp" | "email"; label: string; on: boolean; disabled?: boolean; hint?: string }) {
  return (
    <form action={setConsentAction} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white p-4">
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="granted" value={String(!on)} />
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted">{hint ?? (on ? "You are subscribed." : "You are not subscribed.")}</p>
      </div>
      <button
        type="submit"
        disabled={disabled}
        aria-pressed={on}
        className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${on ? "border border-line hover:bg-paper" : "bg-berry text-cream hover:bg-berry-deep"}`}
      >
        {on ? "Unsubscribe" : "Subscribe"}
      </button>
    </form>
  );
}

export default async function AccountPage() {
  await connection();
  const me = await getCustomer();
  if (!me) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
        <h1 className="font-display text-4xl text-berry sm:text-5xl">Sign in</h1>
        <p className="mb-8 mt-3 max-w-md text-muted">
          Use your mobile number to see your orders and save your details for next time. No password needed. You can always order as a guest.
        </p>
        <PhoneLogin widget={env.messaging.otpWidget} />
      </div>
    );
  }

  const db = await getDb();
  const history = await db
    .select()
    .from(orders)
    .where(and(eq(orders.customerPhone, me.phone), ne(orders.status, "pending_payment"), ne(orders.status, "expired")))
    .orderBy(desc(orders.createdAt))
    .limit(20);
  const [subs, requests] = await Promise.all([subscriptionsForPhone(me.phone), ticketsForPhone(me.phone)]);
  const [mine, loyalty] = await Promise.all([pointsForPhone(me.phone), getStore().then((s) => loyaltySettings(s.outletId))]);

  return (
    <div className="mx-auto max-w-3xl space-y-12 px-4 pt-10 sm:px-6 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-berry sm:text-5xl">{me.name ? `Hi, ${me.name.split(" ")[0]}` : "Your account"}</h1>
          <p className="mt-2 text-muted">+91 {me.phone}</p>
        </div>
        <form action={customerLogoutAction}>
          <button type="submit" className="rounded-full border border-line px-5 py-2 text-sm font-medium hover:bg-paper">Sign out</button>
        </form>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-berry">Your details</h2>
        {!me.name && <p className="rounded-xl bg-butter/60 p-3 text-sm">Add your name so we know who the order is for.</p>}
        <ProfileForm name={me.name} email={me.email} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-berry">Offers & news</h2>
        <p className="text-sm text-muted">Order updates are always sent. These are only for offers and new dishes, and you can stop them any time.</p>
        <ConsentRow channel="whatsapp" label="WhatsApp offers" on={me.marketingWhatsapp} />
        <ConsentRow
          channel="email"
          label="Email offers"
          on={me.marketingEmail}
          disabled={!me.email && !me.marketingEmail}
          hint={!me.email ? "Add your email above to subscribe." : undefined}
        />
      </section>

      {loyalty.enabled && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-butter/60 p-5">
          <div>
            <h2 className="font-display text-2xl text-berry">Your points</h2>
            <p className="text-sm text-ink/70">
              {loyalty.earnPer100} point{loyalty.earnPer100 === 1 ? "" : "s"} for every ₹100
              {loyalty.pointValuePaise > 0 ? ` · each point is ₹${(loyalty.pointValuePaise / 100).toFixed(2).replace(/\.00$/, "")} off` : ""}
              {loyalty.minRedeem > 0 ? ` once you have ${loyalty.minRedeem}` : ""}. Use them at checkout.
            </p>
          </div>
          <p className="font-display text-5xl tabular text-ink">{mine?.balance ?? 0}</p>
        </section>
      )}

      {subs.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl text-berry">Your subscriptions</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {subs.map((s) => {
              const pr = progress(s.mealsUsed, s.mealsTotal);
              return (
                <li key={s.id}>
                  <Link href={`/subscription/${s.publicToken}`} className="flex items-center justify-between gap-4 p-4 hover:bg-paper">
                    <span>
                      <span className="font-semibold">{s.planName}</span>
                      <span className="block text-sm text-muted">{SUB_STATUS_LABEL[s.status as SubStatus]} · {pr.used} of {pr.total} meals</span>
                    </span>
                    <span className="text-sm font-medium text-berry">View →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl text-berry">Help requests</h2>
          <Link href="/support" className="text-sm font-medium text-berry underline">Ask for help</Link>
        </div>
        {requests.length === 0 ? (
          <p className="text-sm text-muted">No requests yet. If anything isn’t right with an order or a plan, tell us and we’ll sort it out.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {requests.map((t) => (
              <li key={t.id}>
                <Link href={`/support/${t.publicToken}`} className="flex items-center justify-between gap-4 p-4 hover:bg-paper">
                  <span>
                    <span className="font-semibold">{t.subject}</span>
                    <span className="block text-sm text-muted">{t.number} · {CUSTOMER_STATUS_LABEL[t.status as TicketStatus]} · {formatDateTime(t.lastMessageAt)}</span>
                  </span>
                  <span className="text-sm font-medium text-berry">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-berry">Your orders</h2>
        {history.length === 0 ? (
          <p className="text-muted">No orders yet. <Link href="/menu" className="font-medium text-berry underline">Browse the menu</Link></p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {history.map((o) => (
              <li key={o.id}>
                <Link href={`/order/${o.publicToken}`} className="flex items-center justify-between gap-4 p-4 hover:bg-paper">
                  <span>
                    <span className="font-semibold">{o.orderNumber}</span>
                    <span className="block text-sm text-muted">{formatDateTime(o.createdAt)}</span>
                  </span>
                  <span className="text-right">
                    <span className="tabular font-semibold">{formatINR(o.totalPaise)}</span>
                    <span className="block text-sm text-muted">{STATUS_LABEL[o.status]}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}