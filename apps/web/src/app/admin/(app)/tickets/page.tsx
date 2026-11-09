import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_LABEL, STATUS_LABEL, TICKET_STATUSES, type TicketCategory, type TicketStatus } from "@seiketsu/core/tickets";
import { can, requirePage } from "@/lib/server/auth";
import { listTickets, ticketCounts } from "@/lib/server/tickets";
import { PageHeader } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Help desk" };

const TONE: Record<TicketStatus, string> = {
  open: "bg-berry/10 text-berry",
  waiting: "bg-butter text-ink",
  resolved: "bg-veg/10 text-veg",
  closed: "bg-paper text-muted",
};

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; mine?: string }> }) {
  const staff = await requirePage(can.manageOrders);
  const sp = await searchParams;
  const status = TICKET_STATUSES.includes(sp.status as TicketStatus) ? (sp.status as TicketStatus) : "active";
  const [rows, counts] = await Promise.all([
    listTickets(staff.outletId, { status, q: sp.q, mine: sp.mine === "1" ? staff.id : undefined }),
    ticketCounts(staff.outletId),
  ]);
  const tabs: [string, string, number | undefined][] = [
    ["active", "Active", (counts.open ?? 0) + (counts.waiting ?? 0)],
    ...TICKET_STATUSES.map((s) => [s, STATUS_LABEL[s], counts[s]] as [string, string, number | undefined]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Help desk" lede="Requests from the contact page, orders, subscriptions and customer accounts. Ones needing a reply come first; payment problems are marked urgent." />

      <nav aria-label="Ticket status" className="flex flex-wrap gap-2">
        {tabs.map(([key, label, n]) => (
          <Link
            key={key}
            href={`/admin/tickets?status=${key}`}
            aria-current={status === key ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${status === key ? "border-ink bg-ink text-cream" : "border-line bg-white hover:bg-paper"}`}
          >
            {label}
            {n ? <span className="tabular ml-1.5 opacity-70">{n}</span> : null}
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="status" value={status} />
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name, phone, subject or T-number" className="min-w-64 flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm" aria-label="Search tickets" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} /> Mine only
        </label>
        <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream">Search</button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">Nothing here. New requests appear as soon as a customer sends one.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {rows.map(({ t, assignee }) => (
            <li key={t.id}>
              <Link href={`/admin/tickets/${t.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-paper">
                <span className="tabular w-16 text-sm text-muted">{t.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {t.priority === "high" && <span className="rounded bg-nonveg px-1.5 py-0.5 text-[11px] font-bold text-white">Urgent</span>}
                    {t.subject}
                  </span>
                  <span className="block text-sm text-muted">
                    {t.name} · {t.phone} · {CATEGORY_LABEL[t.category as TicketCategory] ?? t.category}
                  </span>
                </span>
                <span className="text-sm text-muted">{assignee ?? "Unassigned"}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONE[t.status as TicketStatus]}`}>{STATUS_LABEL[t.status as TicketStatus]}</span>
                <span className="w-32 text-right text-xs text-muted">{formatDateTime(t.lastMessageAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
