import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CATEGORY_LABEL, CUSTOMER_STATUS_LABEL, type TicketCategory, type TicketStatus } from "@seiketsu/core/tickets";
import { ticketByToken } from "@/lib/server/tickets";
import { formatDateTime } from "@/lib/format";
import { ReplyBox } from "./reply-box";

export const metadata: Metadata = { title: "Your help request", robots: { index: false } };

export default async function TicketPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  await connection();
  const [{ token }, { new: isNew }] = await Promise.all([params, searchParams]);
  const found = await ticketByToken(token);
  if (!found) notFound();
  const { ticket: t, messages, order } = found;
  const status = t.status as TicketStatus;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      {isNew && (
        <p role="status" className="rounded-2xl border border-veg/30 bg-veg/5 p-4 text-sm">
          <strong>Thanks, {t.name.split(" ")[0]}.</strong> Your request {t.number} is with our team. Keep this page: our replies appear here.
        </p>
      )}
      <div>
        <p className="text-sm font-semibold text-olive-ink">Help request {t.number}</p>
        <h1 className="mt-2 font-display text-3xl text-berry sm:text-4xl">{t.subject}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-paper px-3 py-1 font-medium">{CUSTOMER_STATUS_LABEL[status]}</span>
          <span className="text-muted">{CATEGORY_LABEL[t.category as TicketCategory] ?? t.category}</span>
          {order && <Link href={`/order/${order.token}`} className="text-berry underline">Order {order.number}</Link>}
        </p>
      </div>

      <ol className="space-y-3" aria-label="Conversation">
        {messages.map((m) => {
          const ours = m.author !== "customer";
          return (
            <li key={m.id} className={`flex ${ours ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${ours ? "rounded-bl-md border border-line bg-white" : "rounded-br-md bg-berry text-cream"}`}>
                <p className={`mb-1 text-xs ${ours ? "text-muted" : "text-cream/75"}`}>{ours ? "Seiketsu team" : "You"} · {formatDateTime(m.createdAt)}</p>
                <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {status === "closed" ? (
        <p className="rounded-2xl bg-paper p-4 text-sm">
          This request is closed. If you still need help, <Link href="/support" className="font-medium text-berry underline">start a new one</Link>.
        </p>
      ) : (
        <ReplyBox token={t.publicToken} />
      )}
      <p className="text-xs text-muted">Anyone with this link can see this conversation, so please don’t share card or bank details here.</p>
    </div>
  );
}
