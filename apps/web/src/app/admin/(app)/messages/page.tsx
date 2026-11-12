import type { Metadata } from "next";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, messageLog, orders, payments } from "@seiketsu/db";
import { maskPhone, milliPaiseToPaise } from "@seiketsu/core/messaging";
import { can, requireStaff } from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { budgetState, daysAgo, getMessagingSettings, istDayStart, istMonthStart } from "@/lib/server/messaging/send";
import { TEMPLATES, type TemplateKind } from "@/lib/server/messaging/templates";
import { formatDateTime, formatINR } from "@/lib/format";
import { MessagingForm } from "./messaging-form";

export const metadata: Metadata = { title: "Messages & costs" };

/** Shows paise with 2 decimals, since single messages cost less than a rupee. */
const inr2 = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

const STATUS_STYLE: Record<string, string> = {
  delivered: "bg-veg/15 text-veg",
  read: "bg-veg/15 text-veg",
  sent: "bg-paper text-ink",
  queued: "bg-paper text-muted",
  failed: "bg-nonveg/15 text-nonveg",
  skipped: "bg-butter text-ink",
};

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" | "over" | "ok" }) {
  const ring = tone === "over" ? "border-nonveg" : tone === "warn" ? "border-orange" : "border-line";
  return (
    <div className={`rounded-2xl border bg-white p-4 ${ring}`}>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default async function MessagesPage() {
  const staff = await requireStaff();
  const settings = await getMessagingSettings(staff.outletId);
  const db = await getDb();
  const day = istDayStart();
  const month = istMonthStart();
  const week = daysAgo(7);

  const [budget, byChannel, weekStats, recent, rzp, placed] = await Promise.all([
    budgetState(settings),
    db
      .select({
        channel: messageLog.channel,
        n: sql<number>`count(*)::int`,
        cost: sql<number>`coalesce(sum(${messageLog.costMilliPaise}) filter (where ${messageLog.status} in ('sent','delivered','read')), 0)::int`,
      })
      .from(messageLog)
      .where(and(eq(messageLog.outletId, staff.outletId), gte(messageLog.createdAt, month)))
      .groupBy(messageLog.channel),
    db
      .select({
        total: sql<number>`count(*) filter (where ${messageLog.status} in ('sent','delivered','read','failed'))::int`,
        delivered: sql<number>`count(*) filter (where ${messageLog.status} in ('delivered','read'))::int`,
        failed: sql<number>`count(*) filter (where ${messageLog.status} = 'failed')::int`,
        skipped: sql<number>`count(*) filter (where ${messageLog.status} = 'skipped')::int`,
        otpToday: sql<number>`count(*) filter (where ${messageLog.kind} = 'otp' and ${messageLog.createdAt} >= ${day.toISOString()})::int`,
      })
      .from(messageLog)
      .where(gte(messageLog.createdAt, week)),
    db.select().from(messageLog).orderBy(desc(messageLog.createdAt)).limit(40),
    db
      .select({
        fee: sql<number>`coalesce(sum(${payments.feePaise}), 0)::int`,
        tax: sql<number>`coalesce(sum(${payments.feeTaxPaise}), 0)::int`,
        gross: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::int`,
        n: sql<number>`count(*)::int`,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(and(eq(orders.outletId, staff.outletId), inArray(payments.status, ["captured", "refunded"]), gte(payments.createdAt, month))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.outletId, staff.outletId), isNotNull(orders.placedAt), gte(orders.placedAt, month))),
  ]);

  const w = weekStats[0];
  const deliveryRate = w && w.total ? Math.round((Number(w.delivered) / Number(w.total)) * 100) : null;
  const monthMsgPaise = milliPaiseToPaise(byChannel.reduce((s, c) => s + Number(c.cost), 0));
  const placedCount = Number(placed[0]?.n ?? 0);
  const r = rzp[0];
  const rzpFees = Number(r?.fee ?? 0) + Number(r?.tax ?? 0);
  const ch = (c: string) => byChannel.find((b) => b.channel === c);

  const kinds = Object.keys(TEMPLATES) as TemplateKind[];
  const modeLabel = {
    live: env.messaging.meta ? "Live: WhatsApp via Meta" : "Live: MSG91",
    log: "Dev log only — nothing is really sent",
    disabled: "Off — no WhatsApp or MSG91 set up",
  }[env.messaging.mode];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-berry">Messages & costs</h1>
          <p className="text-sm text-muted">Costs are estimates from the rates below. Check your MSG91 and Razorpay dashboards for exact bills.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${env.messaging.mode === "live" ? "bg-veg/15 text-veg" : "bg-butter"}`}>{modeLabel}</span>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Spend today" value={inr2(budget.dayPaise)} sub={settings.dailyBudgetPaise ? `of ${formatINR(settings.dailyBudgetPaise)} budget` : "No daily budget"} tone={budget.dayLevel} />
        <Stat label="Spend this month" value={inr2(budget.monthPaise)} sub={settings.monthlyBudgetPaise ? `of ${formatINR(settings.monthlyBudgetPaise)} budget` : "No monthly budget"} tone={budget.monthLevel} />
        <Stat label="Messaging per order" value={placedCount ? inr2(monthMsgPaise / placedCount) : "—"} sub={`${placedCount} paid orders this month`} />
        <Stat label="Delivered (7 days)" value={deliveryRate === null ? "—" : `${deliveryRate}%`} sub={w ? `${w.failed} failed · ${w.skipped} skipped · ${w.otpToday} codes today` : undefined} />
        <Stat label="WhatsApp this month" value={String(ch("whatsapp")?.n ?? 0)} sub={inr2(milliPaiseToPaise(Number(ch("whatsapp")?.cost ?? 0)))} />
        <Stat label="SMS this month" value={String(ch("sms")?.n ?? 0)} sub={inr2(milliPaiseToPaise(Number(ch("sms")?.cost ?? 0)))} />
        <Stat label="Email this month" value={String(ch("email")?.n ?? 0)} sub={inr2(milliPaiseToPaise(Number(ch("email")?.cost ?? 0)))} />
        <Stat
          label="Razorpay fees this month"
          value={formatINR(rzpFees)}
          sub={r && Number(r.gross) ? `${((rzpFees / Number(r.gross)) * 100).toFixed(2)}% of ${formatINR(Number(r.gross))} · ${r.n} payments` : "No payments yet"}
        />
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl">Templates</h2>
        <p className="mb-3 text-sm text-muted">Each message needs an approved template in MSG91. Set the names/IDs as environment variables.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr><th className="py-1.5">Message</th><th>Type</th><th>WhatsApp (MSG91_WA_TPL_…)</th><th>SMS (MSG91_SMS_TPL_…)</th></tr>
            </thead>
            <tbody>
              {kinds.map((k) => (
                <tr key={k} className="border-t border-line">
                  <td className="py-1.5 font-mono text-xs">{k}</td>
                  <td className="capitalize">{TEMPLATES[k].category}</td>
                  <td>{env.messaging.template("WA", k) ? "✓ set" : <span className="text-muted">not set</span>}</td>
                  <td>{!TEMPLATES[k].sms ? <span className="text-muted">not used</span> : env.messaging.template("SMS", k) ? "✓ set" : <span className="text-muted">not set</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {can.manageSettings(staff) && <MessagingForm s={settings} />}

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 font-display text-xl">Recent messages</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">No messages yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-1.5">Time</th><th>Message</th><th>Channel</th><th>To</th><th>Status</th><th className="text-right">Est. cost</th></tr>
              </thead>
              <tbody className="tabular">
                {recent.map((m) => (
                  <tr key={m.id} className="border-t border-line align-top">
                    <td className="py-1.5 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                    <td className="font-mono text-xs">{m.kind}{m.fallbackOf ? " (fallback)" : ""}</td>
                    <td className="capitalize">{m.channel}</td>
                    <td>{m.channel === "email" ? m.recipient : maskPhone(m.recipient)}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[m.status]}`}>{m.status}</span>
                      {m.error && <span className="block max-w-xs truncate text-xs text-muted" title={m.error}>{m.error}</span>}
                    </td>
                    <td className="text-right">{["sent", "delivered", "read"].includes(m.status) ? inr2(m.costMilliPaise / 1000) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}