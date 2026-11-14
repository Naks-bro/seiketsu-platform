import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { customers, getDb, orders } from "@seiketsu/db";
import { ACTIVE_STATUSES, STATUS_LABEL, type OrderStatus } from "@seiketsu/core/order-status";
import { getCustomer, type Customer } from "@/lib/server/customer-auth";
import { subscriptionsForPhone } from "@/lib/server/subscriptions";
import { ticketsForPhone } from "@/lib/server/tickets";
import { CUSTOMER_STATUS_LABEL, type TicketStatus } from "@seiketsu/core/tickets";
import { loyaltySettings, pointsForPhone } from "@/lib/server/rewards";
import { getStore } from "@/lib/server/catalog";
import { listAddresses } from "@/lib/server/addresses";
import { progress, SUB_STATUS_LABEL, type SubStatus } from "@seiketsu/core/subscriptions";
import { env } from "@/lib/server/env";
import { formatDateTime, formatINR } from "@/lib/format";
import { PhoneLogin } from "./phone-login";
import { WhatsAppVerify } from "./whatsapp-verify";
import { codeLoginReady, whatsappLoginReady } from "@/lib/server/whatsapp-login";
import { ProfileForm } from "./profile-form";
import { AddressesPanel } from "./addresses-panel";
import { ReorderButton } from "@/components/site/reorder-button";
import { customerLogoutAction, setConsentAction } from "./actions";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

const TABS = [
  { id: "overview", label: "Overview", icon: "M3 10.5 12 3l9 7.5V21H3z" },
  { id: "orders", label: "Orders", icon: "M6 3h12l1 4H5zM5 7h14v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM9 11h6" },
  { id: "plans", label: "Subscriptions", icon: "M4 5h16v15H4zM4 9h16M9 3v4M15 3v4" },
  { id: "addresses", label: "Addresses", icon: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" },
  { id: "profile", label: "Profile & preferences", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0" },
  { id: "help", label: "Help", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17.5v.01" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function Icon({ d, className = "size-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function ConsentRow({ channel, label, on, disabled, hint }: { channel: "whatsapp" | "email"; label: string; on: boolean; disabled?: boolean; hint?: string }) {
  return (
    <form action={setConsentAction} className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4">
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="granted" value={String(!on)} />
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted">{hint ?? (on ? "You are subscribed." : "You are not subscribed.")}</p>
      </div>
      <button
        type="submit"
        disabled={disabled}
        role="switch"
        aria-checked={on}
        aria-label={`${label}: ${on ? "on" : "off"}`}
        className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-veg" : "bg-line"}`}
      >
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
      </button>
    </form>
  );
}

function StatusChip({ status }: { status: OrderStatus }) {
  const live = ACTIVE_STATUSES.includes(status);
  const bad = status === "cancelled" || status === "rejected" || status === "payment_failed";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${live ? "bg-berry/10 text-berry" : bad ? "bg-nonveg/10 text-nonveg" : "bg-veg/10 text-veg"}`}>
      {live && <span className="size-1.5 rounded-full bg-berry motion-safe:animate-pulse" aria-hidden="true" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

type OrderRow = typeof orders.$inferSelect;

function OrderCard({ o }: { o: OrderRow }) {
  const live = ACTIVE_STATUSES.includes(o.status);
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-white transition hover:border-berry/40 hover:shadow-sm">
      <Link href={`/order/${o.publicToken}`} className="flex items-center gap-4 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper text-berry">
          <Icon d={o.fulfilment === "delivery" ? "M3 16V7h11v9M14 10h4l3 3v3h-7M7.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M17.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" : "M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2"} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{o.orderNumber}</span>
            <StatusChip status={o.status} />
          </span>
          <span className="mt-0.5 block text-sm text-muted">
            {formatDateTime(o.createdAt)} · {o.fulfilment === "delivery" ? "Delivery" : "Pickup"}
          </span>
        </span>
        <span className="text-right">
          <span className="tabular block font-semibold">{formatINR(o.totalPaise)}</span>
          <span className="text-xs font-semibold text-berry">{live ? "Track →" : "Bill →"}</span>
        </span>
      </Link>
      {!live && (
        <div className="flex items-center justify-between gap-3 border-t border-line bg-cream/60 px-4 py-2">
          <span className="text-xs text-muted">Same dishes, today&apos;s prices</span>
          <ReorderButton token={o.publicToken} variant="link" />
        </div>
      )}
    </li>
  );
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-sm text-muted">{children}</div>
    </div>
  );
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await connection();
  const me = await getCustomer();
  if (!me) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
        <h1 className="font-display text-4xl text-berry sm:text-5xl">Sign in</h1>
        <p className="mb-8 mt-3 max-w-md text-muted">
          Use your mobile number to see your orders and save your details for next time. No password needed. You can always order as a guest.
        </p>
        {env.messaging.mode !== "disabled" && env.messaging.codesAvailable && (await codeLoginReady()) ? (
          <PhoneLogin />
        ) : whatsappLoginReady() ? (
          // Until Meta lets us send codes, the customer sends one to us instead.
          <WhatsAppVerify />
        ) : (
          <p className="max-w-sm rounded-2xl border border-line bg-white p-5 text-sm text-muted">Sign-in is not available right now. You can still order as a guest.</p>
        )}
      </div>
    );
  }

  const asked = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.id === asked) ? (asked as Tab) : "overview";
  return <Dashboard me={me} tab={tab} />;
}

async function Dashboard({ me, tab }: { me: Customer; tab: Tab }) {
  const db = await getDb();
  const placed = and(eq(orders.customerPhone, me.phone), ne(orders.status, "pending_payment"), ne(orders.status, "expired"));
  const store = await getStore();
  const [history, [count], [since], subs, requests, mine, loyalty, addresses] = await Promise.all([
    db.select().from(orders).where(placed).orderBy(desc(orders.createdAt)).limit(20),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(placed),
    db.select({ at: customers.createdAt }).from(customers).where(eq(customers.id, me.id)),
    subscriptionsForPhone(me.phone),
    ticketsForPhone(me.phone),
    pointsForPhone(me.phone),
    loyaltySettings(store.outletId),
    listAddresses(me.id),
  ]);
  const live = history.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const activePlans = subs.filter((s) => s.status === "active");
  const pickerStore = { zones: store.zones, location: store.location, deliveryPincodes: store.deliveryPincodes, deliveryFeePaise: store.pricing.deliveryFeePaise, minOrderPaise: store.pricing.minOrderPaise };
  const first = me.name ? me.name.split(" ")[0] : "";
  const memberSince = since?.at ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(since.at) : null;
  const def = addresses.find((a) => a.isDefault);

  const stats = [
    { label: "Orders", value: String(count?.n ?? 0) },
    ...(loyalty.enabled ? [{ label: "Points", value: String(mine?.balance ?? 0) }] : []),
    { label: "Active plans", value: String(activePlans.length) },
    { label: "Addresses", value: String(addresses.length) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
      {/* Header card */}
      <section className="relative overflow-hidden rounded-3xl bg-berry px-6 py-7 text-cream sm:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-cream/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-24 size-40 rounded-full bg-butter/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-cream font-display text-2xl text-berry">{(first || "S").charAt(0).toUpperCase()}</span>
            <div>
              <h1 className="font-display text-3xl leading-tight sm:text-4xl">{first ? `Hi, ${first}` : "Your account"}</h1>
              <p className="text-sm text-cream/80">
                +91 {me.phone}
                {memberSince ? ` · Member since ${memberSince}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/menu" className="rounded-full bg-cream px-5 py-2.5 text-sm font-semibold text-berry hover:bg-butter">
              Order now
            </Link>
            <form action={customerLogoutAction}>
              <button type="submit" className="rounded-full border border-cream/40 px-5 py-2.5 text-sm font-medium hover:bg-berry-deep">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <dl className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-cream/10 px-4 py-3">
              <dt className="text-xs text-cream/75">{s.label}</dt>
              <dd className="tabular font-display text-2xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6 lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
        {/* Tabs: a swipeable strip on phones, a side menu on desktop */}
        <nav aria-label="Account sections" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex gap-2 pb-2 lg:sticky lg:top-24 lg:flex-col lg:gap-1 lg:pb-0">
            {TABS.map((t) => {
              const on = t.id === tab;
              return (
                <li key={t.id} className="shrink-0">
                  <Link
                    href={t.id === "overview" ? "/account" : `/account?tab=${t.id}`}
                    aria-current={on ? "page" : undefined}
                    scroll={false}
                    className={`flex items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition lg:rounded-xl ${on ? "bg-berry text-cream shadow-sm" : "border border-line bg-white text-ink hover:border-berry/40 lg:border-transparent lg:bg-transparent lg:hover:bg-white"}`}
                  >
                    <Icon d={t.icon} className="size-[18px]" />
                    {t.label}
                    {t.id === "orders" && live.length > 0 && <span className={`rounded-full px-1.5 text-[11px] font-bold ${on ? "bg-cream text-berry" : "bg-berry text-cream"}`}>{live.length}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="mt-4 min-w-0 space-y-8 lg:mt-0">
          {tab === "overview" && (
            <>
              {live.length > 0 && (
                <section className="space-y-3">
                  <h2 className="font-display text-2xl text-berry">On its way</h2>
                  <ul className="space-y-2">
                    {live.map((o) => (
                      <OrderCard key={o.id} o={o} />
                    ))}
                  </ul>
                </section>
              )}
              <section className="grid gap-3 sm:grid-cols-2">
                <Link href="/account?tab=addresses" className="rounded-2xl border border-line bg-white p-5 transition hover:border-berry/40">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Delivering to</p>
                  <p className="mt-1 font-semibold">{def ? def.label : "No address saved"}</p>
                  <p className="line-clamp-2 text-sm text-muted">{def ? [def.house, def.building, def.area].filter(Boolean).join(", ") : "Add one for one-tap checkout →"}</p>
                </Link>
                {loyalty.enabled ? (
                  <div className="rounded-2xl bg-butter/60 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink/60">Your points</p>
                    <p className="tabular font-display text-4xl">{mine?.balance ?? 0}</p>
                    <p className="text-sm text-ink/70">
                      {loyalty.earnPer100} point{loyalty.earnPer100 === 1 ? "" : "s"} per ₹100
                      {loyalty.pointValuePaise > 0 ? ` · each worth ₹${(loyalty.pointValuePaise / 100).toFixed(2).replace(/\.00$/, "")}` : ""}
                      {loyalty.minRedeem > 0 ? ` · use from ${loyalty.minRedeem}` : ""}
                    </p>
                  </div>
                ) : (
                  <Link href="/account?tab=plans" className="rounded-2xl border border-line bg-white p-5 transition hover:border-berry/40">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Meal plans</p>
                    <p className="mt-1 font-semibold">{activePlans.length ? `${activePlans.length} active` : "No active plan"}</p>
                    <p className="text-sm text-muted">{activePlans.length ? "See meals used and what's next →" : "Clean meals for the week, sorted →"}</p>
                  </Link>
                )}
              </section>
              {!me.name && (
                <Link href="/account?tab=profile" className="block rounded-2xl bg-butter/60 p-4 text-sm">
                  <strong>Add your name</strong> so we know who the order is for →
                </Link>
              )}
              <section className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-2xl text-berry">Recent orders</h2>
                  {history.length > 3 && (
                    <Link href="/account?tab=orders" className="text-sm font-semibold text-berry">
                      See all
                    </Link>
                  )}
                </div>
                {history.length === 0 ? (
                  <Empty title="No orders yet">
                    <Link href="/menu" className="font-semibold text-berry underline">Browse the menu</Link>
                  </Empty>
                ) : (
                  <ul className="space-y-2">
                    {history.filter((o) => !ACTIVE_STATUSES.includes(o.status)).slice(0, 3).map((o) => (
                      <OrderCard key={o.id} o={o} />
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {tab === "orders" && (
            <section className="space-y-3">
              <h2 className="font-display text-2xl text-berry">Your orders</h2>
              {history.length === 0 ? (
                <Empty title="No orders yet">
                  <Link href="/menu" className="font-semibold text-berry underline">Browse the menu</Link>
                </Empty>
              ) : (
                <>
                  <ul className="space-y-2">
                    {history.map((o) => (
                      <OrderCard key={o.id} o={o} />
                    ))}
                  </ul>
                  {(count?.n ?? 0) > history.length && <p className="text-center text-sm text-muted">Showing your latest {history.length} orders.</p>}
                </>
              )}
            </section>
          )}

          {tab === "plans" && (
            <section className="space-y-3">
              <h2 className="font-display text-2xl text-berry">Your subscriptions</h2>
              {subs.length === 0 ? (
                <Empty title="No meal plans yet">
                  <Link href="/#plans" className="font-semibold text-berry underline">See our plans</Link>
                </Empty>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {subs.map((s) => {
                    const pr = progress(s.mealsUsed, s.mealsTotal);
                    const pct = pr.total ? Math.round((pr.used / pr.total) * 100) : 0;
                    return (
                      <li key={s.id}>
                        <Link href={`/subscription/${s.publicToken}`} className="block rounded-2xl border border-line bg-white p-5 transition hover:border-berry/40">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold">{s.planName}</p>
                            <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-semibold">{SUB_STATUS_LABEL[s.status as SubStatus]}</span>
                          </div>
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuenow={pr.used} aria-valuemin={0} aria-valuemax={pr.total} aria-label="Meals used">
                            <div className="h-full rounded-full bg-veg" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="mt-2 text-sm text-muted">
                            {pr.used} of {pr.total} meals used
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {tab === "addresses" && (
            <section className="space-y-3">
              <h2 className="font-display text-2xl text-berry">Saved addresses</h2>
              <AddressesPanel initial={addresses} store={pickerStore} />
            </section>
          )}

          {tab === "profile" && (
            <>
              <section className="space-y-4">
                <h2 className="font-display text-2xl text-berry">Your details</h2>
                {!me.name && <p className="rounded-xl bg-butter/60 p-3 text-sm">Add your name so we know who the order is for.</p>}
                <div className="rounded-2xl border border-line bg-white p-5">
                  <ProfileForm name={me.name} email={me.email} />
                </div>
              </section>
              <section className="space-y-3">
                <h2 className="font-display text-2xl text-berry">Offers & news</h2>
                <p className="text-sm text-muted">Order updates are always sent. These are only for offers and new dishes, and you can stop them any time.</p>
                <ConsentRow channel="whatsapp" label="WhatsApp offers" on={me.marketingWhatsapp} />
                <ConsentRow channel="email" label="Email offers" on={me.marketingEmail} disabled={!me.email && !me.marketingEmail} hint={!me.email ? "Add your email above to subscribe." : undefined} />
              </section>
            </>
          )}

          {tab === "help" && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl text-berry">Help requests</h2>
                <Link href="/support" className="rounded-full bg-berry px-4 py-2 text-sm font-semibold text-cream hover:bg-berry-deep">
                  Ask for help
                </Link>
              </div>
              {requests.length === 0 ? (
                <Empty title="No requests yet">If anything isn&apos;t right with an order or a plan, tell us and we&apos;ll sort it out.</Empty>
              ) : (
                <ul className="space-y-2">
                  {requests.map((t) => (
                    <li key={t.id}>
                      <Link href={`/support/${t.publicToken}`} className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4 transition hover:border-berry/40">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{t.subject}</span>
                          <span className="flex flex-wrap gap-x-3 text-sm text-muted">
                            <span>{t.number}</span>
                            <span>{CUSTOMER_STATUS_LABEL[t.status as TicketStatus]}</span>
                            <span>{formatDateTime(t.lastMessageAt)}</span>
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-berry">Open →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
