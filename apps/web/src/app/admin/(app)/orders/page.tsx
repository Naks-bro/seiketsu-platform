import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gte, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import { getDb, orderItemAddons, orderItems, orders } from "@seiketsu/db";
import { ACTIVE_STATUSES, ORDER_STATUSES, STATUS_LABEL, staffActions, type OrderStatus } from "@seiketsu/core/order-status";
import { can, requirePage } from "@/lib/server/auth";
import { formatINR, formatTimeOnly, formatDateTime } from "@/lib/format";
import { AdminLive } from "../admin-live";
import { StatusActions } from "./status-actions";
import { StatusPill } from "./status-pill";

export const metadata: Metadata = { title: "Orders" };

const COLUMNS: { title: string; statuses: OrderStatus[] }[] = [
  { title: "New", statuses: ["placed"] },
  { title: "Accepted", statuses: ["accepted"] },
  { title: "Preparing", statuses: ["preparing"] },
  { title: "Ready / out", statuses: ["ready", "out_for_delivery"] },
];

/** India is UTC+5:30 with no daylight saving. */
const istMidnight = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T00:00:00+05:30`);

type Search = { view?: string; q?: string; status?: string; from?: string; to?: string; source?: string };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const staff = await requirePage(can.manageOrders);
  const sp = await searchParams;
  const view = sp.view === "all" ? "all" : "active";
  const db = await getDb();

  const conds: SQL[] = [eq(orders.outletId, staff.outletId)];
  if (view === "active") conds.push(inArray(orders.status, ACTIVE_STATUSES));
  else {
    if (sp.status && (ORDER_STATUSES as readonly string[]).includes(sp.status)) conds.push(eq(orders.status, sp.status as OrderStatus));
    if (sp.source && ["web", "qr", "pos", "staff"].includes(sp.source)) conds.push(eq(orders.source, sp.source as "web"));
    if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) conds.push(gte(orders.createdAt, istMidnight(sp.from)));
    if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) conds.push(lt(orders.createdAt, new Date(istMidnight(sp.to).getTime() + 86400000)));
    const q = sp.q?.trim();
    if (q) {
      const like = `%${q.replace(/[%_]/g, "")}%`;
      conds.push(or(ilike(orders.orderNumber, like), ilike(orders.customerPhone, like), ilike(orders.customerName, like))!);
    }
  }

  const rows = await db.select().from(orders).where(and(...conds)).orderBy(desc(orders.createdAt)).limit(view === "active" ? 200 : 100);
  const ids = rows.map((r) => r.id);
  const items = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
  const itemAddons = items.length ? await db.select().from(orderItemAddons).where(inArray(orderItemAddons.orderItemId, items.map((i) => i.id))) : [];
  const newCount = rows.filter((r) => r.status === "placed").length;

  const tab = (v: string, label: string) => (
    <Link href={`/admin/orders?view=${v}`} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === v ? "bg-berry text-cream" : "hover:bg-paper"}`}>
      {label}
    </Link>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl">Orders</h1>
        <div className="flex gap-1">{tab("active", `Live (${view === "active" ? rows.length : "…"})`)}{tab("all", "All orders")}</div>
        <div className="ml-auto"><AdminLive outletId={staff.outletId} newCount={newCount} /></div>
      </div>

      {view === "active" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const list = rows.filter((r) => col.statuses.includes(r.status)).reverse();
            return (
              <section key={col.title} className="rounded-2xl bg-paper/70 p-3" aria-label={col.title}>
                <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">
                  {col.title}
                  <span className="tabular rounded-full bg-cream px-2 text-xs">{list.length}</span>
                </h2>
                <ul className="space-y-3">
                  {list.map((o) => {
                    const its = items.filter((i) => i.orderId === o.id);
                    const mins = Math.floor((Date.now() - (o.placedAt ?? o.createdAt).getTime()) / 60000);
                    return (
                      <li key={o.id} className={`rounded-xl border bg-white p-3 shadow-sm ${o.status === "placed" ? "border-orange" : "border-line"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/admin/orders/${o.id}`} className="font-semibold hover:text-berry">{o.orderNumber}</Link>
                          <span className={`tabular text-xs ${mins >= 20 ? "font-semibold text-nonveg" : "text-muted"}`}>{mins} min</span>
                        </div>
                        <p className="text-xs text-muted">
                          {o.customerName} · <span className="capitalize">{o.fulfilment}</span> · {formatTimeOnly(o.placedAt ?? o.createdAt)}
                        </p>
                        <ul className="mt-2 space-y-1 text-sm">
                          {its.map((i) => (
                            <li key={i.id}>
                              <span className="font-semibold">{i.quantity}×</span> {i.itemName}
                              {i.variantLabel && <span className="text-muted"> · {i.variantLabel}</span>}
                              {itemAddons.filter((a) => a.orderItemId === i.id).map((a) => (
                                <span key={a.id} className="block pl-5 text-xs text-muted">+ {a.name}</span>
                              ))}
                              {i.note && <span className="block pl-5 text-xs italic text-berry">“{i.note}”</span>}
                            </li>
                          ))}
                        </ul>
                        {o.notes && <p className="mt-2 rounded bg-butter/60 px-2 py-1 text-xs">Note: {o.notes}</p>}
                        <div className="mt-3">
                          <StatusActions compact orderId={o.id} paid={o.paymentState === "paid"} actions={staffActions(o.status, o.fulfilment).map((a) => ({ to: a.to, needsReason: a.needsReason }))} />
                        </div>
                      </li>
                    );
                  })}
                  {list.length === 0 && <li className="px-1 py-6 text-center text-xs text-muted">Nothing here</li>}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-white p-3 text-sm">
            <input type="hidden" name="view" value="all" />
            <label className="space-y-1">
              <span className="block text-xs text-muted">Search</span>
              <input name="q" defaultValue={sp.q} placeholder="Order no., name or phone" className="rounded-lg border border-line px-3 py-1.5" />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-muted">Status</span>
              <select name="status" defaultValue={sp.status ?? ""} className="rounded-lg border border-line px-2 py-1.5">
                <option value="">Any</option>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-muted">Source</span>
              <select name="source" defaultValue={sp.source ?? ""} className="rounded-lg border border-line px-2 py-1.5">
                <option value="">Any</option>
                <option value="web">Website</option>
                <option value="qr">QR menu</option>
                <option value="pos">POS</option>
                <option value="staff">Staff</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-muted">From</span>
              <input type="date" name="from" defaultValue={sp.from} className="rounded-lg border border-line px-2 py-1.5" />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-muted">To</span>
              <input type="date" name="to" defaultValue={sp.to} className="rounded-lg border border-line px-2 py-1.5" />
            </label>
            <button type="submit" className="rounded-lg bg-berry px-4 py-1.5 font-semibold text-cream">Filter</button>
            <Link href="/admin/orders?view=all" className="px-2 py-1.5 text-muted hover:text-ink">Clear</Link>
          </form>
          <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Placed</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((o) => (
                  <tr key={o.id} className="hover:bg-paper/50">
                    <td className="px-3 py-2 font-semibold"><Link href={`/admin/orders/${o.id}`} className="hover:text-berry">{o.orderNumber}</Link></td>
                    <td className="tabular px-3 py-2 text-muted">{formatDateTime(o.createdAt)}</td>
                    <td className="px-3 py-2">{o.customerName}<span className="block text-xs text-muted">{o.customerPhone}</span></td>
                    <td className="px-3 py-2 capitalize">{o.fulfilment}</td>
                    <td className="px-3 py-2 uppercase text-xs text-muted">{o.source}</td>
                    <td className="tabular px-3 py-2 text-right">{formatINR(o.totalPaise)}</td>
                    <td className="px-3 py-2 capitalize text-muted">{o.paymentState.replace("_", " ")}</td>
                    <td className="px-3 py-2"><StatusPill status={o.status} /></td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-10 text-center text-muted">No orders match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length === 100 && <p className="text-xs text-muted">Showing the latest 100. Narrow the dates to see older orders.</p>}
        </>
      )}
    </div>
  );
}