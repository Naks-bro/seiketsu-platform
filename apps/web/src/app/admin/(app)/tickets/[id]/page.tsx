import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_LABEL, STATUS_LABEL, TICKET_STATUSES, canSetStatus, type TicketCategory, type TicketStatus } from "@seiketsu/core/tickets";
import { can, requirePage } from "@/lib/server/auth";
import { getTicket, teamFor } from "@/lib/server/tickets";
import { PageHeader, btnGhost, btnPrimary, field } from "@/components/admin/ui";
import { formatDateTime, formatINR } from "@/lib/format";
import { assignTicketAction, priorityAction, ticketStatusAction } from "../../../ticket-actions";
import { StaffReply } from "./staff-reply";

export const metadata: Metadata = { title: "Ticket" };

const MOVE: Record<TicketStatus, string> = { open: "Reopen", waiting: "Waiting on customer", resolved: "Mark resolved", closed: "Close" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePage(can.manageOrders);
  const { id } = await params;
  const found = /^[0-9a-f-]{36}$/.test(id) ? await getTicket(staff.outletId, id) : null;
  if (!found) notFound();
  const { ticket: t, messages, order, subscription, history } = found;
  const status = t.status as TicketStatus;
  const team = await teamFor(staff.outletId);

  return (
    <div className="space-y-6">
      <Link href="/admin/tickets" className="text-sm text-berry hover:underline">← Help desk</Link>
      <PageHeader title={t.subject} lede={`${t.number} · ${CATEGORY_LABEL[t.category as TicketCategory] ?? t.category} · opened ${formatDateTime(t.createdAt)}`}>
        <span className="rounded-full bg-paper px-3 py-1 text-sm font-medium">{STATUS_LABEL[status]}</span>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <ol className="space-y-3" aria-label="Conversation">
            {messages.map(({ m, staffName }) => (
              <li key={m.id} className={`rounded-2xl border p-4 text-sm ${m.internal ? "border-dashed border-orange/50 bg-butter/40" : m.author === "customer" ? "border-line bg-white" : "border-berry/20 bg-berry/5"}`}>
                <p className="mb-1 text-xs text-muted">
                  {m.author === "customer" ? t.name : (staffName ?? "Team")}
                  {m.internal && " · internal note"} · {formatDateTime(m.createdAt)}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
              </li>
            ))}
          </ol>
          {status !== "closed" && <StaffReply id={t.id} phone={t.phone} />}
        </div>

        <aside className="space-y-4">
          <section className="space-y-2 rounded-2xl border border-line bg-white p-4 text-sm">
            <h2 className="font-display text-lg">Customer</h2>
            <p className="font-medium">{t.name}</p>
            <p><a href={`tel:+91${t.phone}`} className="text-berry">{t.phone}</a>{t.email ? ` · ${t.email}` : ""}</p>
            <p className="text-xs text-muted">
              Their request page: <a href={`/support/${t.publicToken}`} target="_blank" rel="noreferrer" className="underline">open</a> (share this link with them).
            </p>
            {order && (
              <p>Order <Link href={`/admin/orders/${order.id}`} className="font-medium text-berry hover:underline">{order.number}</Link> · {order.status.replace(/_/g, " ")} · {formatINR(order.totalPaise)}</p>
            )}
            {subscription && (
              <p>Plan <Link href={`/admin/subscriptions/subscribers/${subscription.id}`} className="font-medium text-berry hover:underline">{subscription.planName}</Link> · {subscription.status}</p>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
            <h2 className="font-display text-lg">Status</h2>
            <div className="flex flex-wrap gap-2">
              {TICKET_STATUSES.filter((to) => canSetStatus(status, to)).map((to) => (
                <form key={to} action={ticketStatusAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="to" value={to} />
                  <button type="submit" className={to === "resolved" ? btnPrimary : btnGhost}>{MOVE[to]}</button>
                </form>
              ))}
            </div>
            <form action={assignTicketAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={t.id} />
              <select name="assignee" defaultValue={t.assigneeId ?? ""} className={field} aria-label="Assigned to">
                <option value="">Unassigned</option>
                {team.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button type="submit" className={btnGhost}>Assign</button>
            </form>
            <form action={priorityAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="priority" value={t.priority === "high" ? "normal" : "high"} />
              <button type="submit" className="text-sm text-berry underline">{t.priority === "high" ? "Remove urgent flag" : "Mark urgent"}</button>
            </form>
          </section>

          {history.length > 0 && (
            <section className="space-y-2 rounded-2xl border border-line bg-white p-4 text-sm">
              <h2 className="font-display text-lg">Earlier requests</h2>
              <ul className="space-y-1">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link href={`/admin/tickets/${h.id}`} className="text-berry hover:underline">{h.number}</Link> {h.subject}{" "}
                    <span className="text-muted">· {STATUS_LABEL[h.status as TicketStatus]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
