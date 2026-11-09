import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb, orders, staffRoles, staffUsers, subscriptions, ticketMessages, tickets } from "@seiketsu/db";
import { canSetStatus, statusAfterCustomerReply, statusAfterStaffReply, type NewTicket, type TicketStatus } from "@seiketsu/core/tickets";
import { audit } from "./audit";

export type Ticket = typeof tickets.$inferSelect;
export class TicketError extends Error {}

/** Opens a ticket with the customer's first message. Order and subscription links come from their secret page tokens. */
export async function createTicket(
  input: NewTicket & { outletId: string; customerId: string | null; orderToken?: string | null; subscriptionToken?: string | null; source: string },
) {
  const db = await getDb();
  const [order] = input.orderToken
    ? await db.select({ id: orders.id, outletId: orders.outletId }).from(orders).where(eq(orders.publicToken, input.orderToken))
    : [];
  const [sub] = input.subscriptionToken
    ? await db.select({ id: subscriptions.id, outletId: subscriptions.outletId }).from(subscriptions).where(eq(subscriptions.publicToken, input.subscriptionToken))
    : [];
  const outletId = order?.outletId ?? sub?.outletId ?? input.outletId;
  return db.transaction(async (tx) => {
    const [t] = await tx
      .insert(tickets)
      .values({
        outletId,
        publicToken: randomBytes(18).toString("base64url"),
        subject: input.subject,
        category: input.category,
        // Payment and refund problems go to the top of the list.
        priority: input.category === "payment" ? "high" : "normal",
        source: input.source,
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        customerId: input.customerId,
        orderId: order?.id ?? null,
        subscriptionId: sub?.id ?? null,
      })
      .returning();
    await tx.insert(ticketMessages).values({ ticketId: t.id, author: "customer", body: input.message });
    return t;
  });
}

/** The customer's view: their thread without staff-only notes. */
export async function ticketByToken(token: string) {
  const db = await getDb();
  const [t] = await db.select().from(tickets).where(eq(tickets.publicToken, token));
  if (!t) return null;
  const messages = await db
    .select()
    .from(ticketMessages)
    .where(and(eq(ticketMessages.ticketId, t.id), eq(ticketMessages.internal, false)))
    .orderBy(asc(ticketMessages.createdAt));
  const [order] = t.orderId ? await db.select({ number: orders.orderNumber, token: orders.publicToken }).from(orders).where(eq(orders.id, t.orderId)) : [];
  return { ticket: t, messages, order: order ?? null };
}

export async function customerReply(token: string, body: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(tickets).where(eq(tickets.publicToken, token)).for("update");
    if (!t) throw new TicketError("Request not found.");
    const next = statusAfterCustomerReply(t.status as TicketStatus);
    if (!next) throw new TicketError("This request is closed. Please start a new one.");
    await tx.insert(ticketMessages).values({ ticketId: t.id, author: "customer", body });
    await tx.update(tickets).set({ status: next, resolvedAt: null, lastMessageAt: new Date() }).where(eq(tickets.id, t.id));
  });
}

export async function staffReply(outletId: string, id: string, staffId: string, body: string, internal: boolean) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(tickets).where(and(eq(tickets.id, id), eq(tickets.outletId, outletId))).for("update");
    if (!t) throw new TicketError("Ticket not found.");
    await tx.insert(ticketMessages).values({ ticketId: t.id, author: "staff", staffId, body, internal });
    const now = new Date();
    await tx
      .update(tickets)
      .set({
        status: statusAfterStaffReply(t.status as TicketStatus, internal),
        lastMessageAt: internal ? t.lastMessageAt : now,
        firstResponseAt: !internal && !t.firstResponseAt ? now : t.firstResponseAt,
        // Whoever answers first owns it until someone reassigns it.
        assigneeId: t.assigneeId ?? staffId,
      })
      .where(eq(tickets.id, t.id));
  });
}

export async function setTicketStatus(outletId: string, id: string, to: TicketStatus, staffId: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(tickets).where(and(eq(tickets.id, id), eq(tickets.outletId, outletId))).for("update");
    if (!t) throw new TicketError("Ticket not found.");
    if (!canSetStatus(t.status as TicketStatus, to)) throw new TicketError(`A ${t.status} ticket can't be set to ${to}.`);
    await tx.update(tickets).set({ status: to, resolvedAt: to === "resolved" || to === "closed" ? new Date() : null }).where(eq(tickets.id, t.id));
    await audit(tx, { actorId: staffId, outletId, action: `ticket.${to}`, entity: "ticket", entityId: t.id });
  });
}

export async function assignTicket(outletId: string, id: string, assigneeId: string | null) {
  const db = await getDb();
  if (assigneeId) {
    const [ok] = await db
      .select({ id: staffRoles.staffUserId })
      .from(staffRoles)
      .where(and(eq(staffRoles.staffUserId, assigneeId), eq(staffRoles.outletId, outletId)));
    if (!ok) throw new TicketError("That person isn't on this outlet's team.");
  }
  await db.update(tickets).set({ assigneeId }).where(and(eq(tickets.id, id), eq(tickets.outletId, outletId)));
}

export async function setPriority(outletId: string, id: string, priority: "normal" | "high") {
  const db = await getDb();
  await db.update(tickets).set({ priority }).where(and(eq(tickets.id, id), eq(tickets.outletId, outletId)));
}

/** The inbox: tickets needing a reply first, urgent before normal, longest-waiting first. */
export async function listTickets(outletId: string, opts: { status?: TicketStatus | "active"; q?: string; mine?: string } = {}) {
  const db = await getDb();
  const statusWhere = !opts.status || opts.status === "active" ? inArray(tickets.status, ["open", "waiting"]) : eq(tickets.status, opts.status);
  const q = opts.q?.trim();
  const digits = q?.replace(/\D/g, "");
  return db
    .select({ t: tickets, assignee: staffUsers.name })
    .from(tickets)
    .leftJoin(staffUsers, eq(staffUsers.id, tickets.assigneeId))
    .where(
      and(
        eq(tickets.outletId, outletId),
        statusWhere,
        opts.mine ? eq(tickets.assigneeId, opts.mine) : undefined,
        q
          ? or(ilike(tickets.subject, `%${q}%`), ilike(tickets.name, `%${q}%`), ilike(tickets.number, `%${q}%`), digits ? ilike(tickets.phone, `%${digits}%`) : undefined)
          : undefined,
      ),
    )
    .orderBy(sql`case when ${tickets.status} = 'open' then 0 else 1 end`, sql`case when ${tickets.priority} = 'high' then 0 else 1 end`, asc(tickets.lastMessageAt))
    .limit(300);
}

export async function ticketCounts(outletId: string) {
  const db = await getDb();
  const rows = await db
    .select({ status: tickets.status, n: sql<number>`count(*)::int` })
    .from(tickets)
    .where(eq(tickets.outletId, outletId))
    .groupBy(tickets.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<TicketStatus, number>>;
}

/** Staff view: the whole thread with internal notes, what it is linked to, and the customer's earlier tickets. */
export async function getTicket(outletId: string, id: string) {
  const db = await getDb();
  const [t] = await db.select().from(tickets).where(and(eq(tickets.id, id), eq(tickets.outletId, outletId)));
  if (!t) return null;
  const messages = await db
    .select({ m: ticketMessages, staffName: staffUsers.name })
    .from(ticketMessages)
    .leftJoin(staffUsers, eq(staffUsers.id, ticketMessages.staffId))
    .where(eq(ticketMessages.ticketId, t.id))
    .orderBy(asc(ticketMessages.createdAt));
  const [order] = t.orderId
    ? await db.select({ id: orders.id, number: orders.orderNumber, status: orders.status, totalPaise: orders.totalPaise }).from(orders).where(eq(orders.id, t.orderId))
    : [];
  const [sub] = t.subscriptionId
    ? await db.select({ id: subscriptions.id, planName: subscriptions.planName, status: subscriptions.status }).from(subscriptions).where(eq(subscriptions.id, t.subscriptionId))
    : [];
  const history = await db
    .select({ id: tickets.id, number: tickets.number, subject: tickets.subject, status: tickets.status, createdAt: tickets.createdAt })
    .from(tickets)
    .where(and(eq(tickets.outletId, outletId), eq(tickets.phone, t.phone)))
    .orderBy(desc(tickets.createdAt))
    .limit(10);
  return { ticket: t, messages, order: order ?? null, subscription: sub ?? null, history: history.filter((h) => h.id !== t.id) };
}

export async function teamFor(outletId: string) {
  const db = await getDb();
  return db
    .select({ id: staffUsers.id, name: staffUsers.name })
    .from(staffRoles)
    .innerJoin(staffUsers, eq(staffUsers.id, staffRoles.staffUserId))
    .where(and(eq(staffRoles.outletId, outletId), eq(staffUsers.isActive, true)))
    .orderBy(asc(staffUsers.name));
}

export async function ticketsForPhone(phone: string) {
  const db = await getDb();
  return db.select().from(tickets).where(eq(tickets.phone, phone)).orderBy(desc(tickets.lastMessageAt)).limit(20);
}
