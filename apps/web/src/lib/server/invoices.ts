import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { getDb, invoiceCounters, invoices, orders, type Db, type InvoiceLine, type TaxSnapshot } from "@seiketsu/db";
import { financialYear, formatInvoiceNumber } from "@seiketsu/core/messaging";
import { counterKey, creditFor, SERIES, type Amounts, type InvoiceKind } from "@seiketsu/core/invoices";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Next number in a series for the financial year; the counter row lock keeps numbers gap-free. */
export async function nextNumber(tx: Tx, prefix: string, at: Date) {
  const fy = financialYear(at);
  const key = counterKey(prefix, fy);
  const [c] = await tx
    .insert(invoiceCounters)
    .values({ financialYear: key, last: 1 })
    .onConflictDoUpdate({ target: invoiceCounters.financialYear, set: { last: sql`${invoiceCounters.last} + 1` } })
    .returning();
  return formatInvoiceNumber(prefix, fy, c.last);
}

export const nextInvoiceNumber = (tx: Tx, at: Date) => nextNumber(tx, SERIES.invoice, at);

type Party = { name: string; phone: string | null; email: string | null; address: string | null };
type Issuer = { name: string; addressLines: string[]; phone: string | null };

export async function issueInvoice(
  tx: Tx,
  args: {
    outletId: string;
    kind: Exclude<InvoiceKind, "order">;
    at: Date;
    to: Party;
    issuer: Issuer;
    lines: InvoiceLine[];
    amounts: Amounts;
    tax: TaxSnapshot;
    subscriptionId?: string | null;
    subscriptionPaymentId?: string | null;
    orderId?: string | null;
    againstNumber?: string | null;
    refundRef?: string | null;
    paymentMethod?: string | null;
  },
) {
  const number = await nextNumber(tx, args.kind === "credit_note" ? SERIES.credit : SERIES.invoice, args.at);
  const [row] = await tx
    .insert(invoices)
    .values({
      outletId: args.outletId,
      kind: args.kind,
      number,
      publicToken: randomBytes(18).toString("base64url"),
      issuedAt: args.at,
      customerName: args.to.name,
      customerPhone: args.to.phone,
      customerEmail: args.to.email,
      billingAddress: args.to.address,
      subscriptionId: args.subscriptionId ?? null,
      subscriptionPaymentId: args.subscriptionPaymentId ?? null,
      orderId: args.orderId ?? null,
      againstNumber: args.againstNumber ?? null,
      refundRef: args.refundRef ?? null,
      lines: args.lines,
      taxablePaise: args.amounts.taxablePaise,
      taxPaise: args.amounts.taxPaise,
      totalPaise: args.amounts.totalPaise,
      taxSnapshot: args.tax,
      issuer: args.issuer,
      paymentMethod: args.paymentMethod ?? null,
    })
    .returning();
  return row;
}

/**
 * A credit note for a processed refund on an order bill. Safe to call twice:
 * the refund reference is unique, so the second call changes nothing.
 */
export async function creditOrderRefund(tx: Tx, o: typeof orders.$inferSelect, refund: { ref: string; amountPaise: number; at: Date }) {
  if (!o.invoiceNumber) return null;
  const [done] = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.refundRef, refund.ref));
  if (done) return null;
  const amounts = creditFor(refund.amountPaise, { taxablePaise: o.totalPaise - o.taxPaise, taxPaise: o.taxPaise, totalPaise: o.totalPaise });
  const issuer = o.issuerSnapshot ?? { name: "Seiketsu", addressLines: [], phone: null };
  return issueInvoice(tx, {
    outletId: o.outletId,
    kind: "credit_note",
    at: refund.at,
    to: { name: o.customerName, phone: o.customerPhone, email: o.customerEmail, address: null },
    issuer: { name: issuer.name, addressLines: issuer.addressLines, phone: issuer.phone },
    lines: [{ label: `Refund against ${o.invoiceNumber}`, detail: `Order ${o.orderNumber}`, quantity: 1, amountPaise: amounts.taxablePaise }],
    amounts,
    tax: o.taxSnapshot,
    orderId: o.id,
    againstNumber: o.invoiceNumber,
    refundRef: refund.ref,
  });
}

export type RegisterRow = {
  kind: InvoiceKind;
  number: string;
  issuedAt: Date;
  customerName: string;
  customerPhone: string | null;
  taxablePaise: number;
  taxPaise: number;
  totalPaise: number;
  gstin: string | null;
  againstNumber: string | null;
  href: string;
};

/** Order bills and invoices together, newest first, for one outlet and an optional date range. */
export async function invoiceRegister(outletId: string, opts: { from?: Date; to?: Date; kind?: InvoiceKind; limit?: number } = {}): Promise<RegisterRow[]> {
  const db = await getDb();
  const limit = opts.limit ?? 500;
  const rows: RegisterRow[] = [];
  if (!opts.kind || opts.kind === "order") {
    const at = sql<Date>`coalesce(${orders.placedAt}, ${orders.createdAt})`;
    const os = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.outletId, outletId),
          isNotNull(orders.invoiceNumber),
          // A raw expression has no column type, so the dates go in as ISO text and Postgres reads them as timestamps.
          opts.from ? sql`${at} >= ${opts.from.toISOString()}::timestamptz` : undefined,
          opts.to ? sql`${at} < ${opts.to.toISOString()}::timestamptz` : undefined,
        ),
      )
      .orderBy(desc(at))
      .limit(limit);
    for (const o of os) {
      rows.push({
        kind: "order",
        number: o.invoiceNumber!,
        issuedAt: o.placedAt ?? o.createdAt,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        taxablePaise: o.totalPaise - o.taxPaise,
        taxPaise: o.taxPaise,
        totalPaise: o.totalPaise,
        gstin: o.taxSnapshot.enabled ? o.taxSnapshot.gstin : null,
        againstNumber: null,
        href: `/bill/${o.publicToken}`,
      });
    }
  }
  if (opts.kind !== "order") {
    const is = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.outletId, outletId),
          opts.kind ? eq(invoices.kind, opts.kind) : undefined,
          opts.from ? gte(invoices.issuedAt, opts.from) : undefined,
          opts.to ? lt(invoices.issuedAt, opts.to) : undefined,
        ),
      )
      .orderBy(desc(invoices.issuedAt))
      .limit(limit);
    for (const i of is) {
      rows.push({
        kind: i.kind as InvoiceKind,
        number: i.number,
        issuedAt: i.issuedAt,
        customerName: i.customerName,
        customerPhone: i.customerPhone,
        // Credit notes reduce revenue, so the register shows them as negative.
        taxablePaise: i.kind === "credit_note" ? -i.taxablePaise : i.taxablePaise,
        taxPaise: i.kind === "credit_note" ? -i.taxPaise : i.taxPaise,
        totalPaise: i.kind === "credit_note" ? -i.totalPaise : i.totalPaise,
        gstin: i.taxSnapshot.enabled ? i.taxSnapshot.gstin : null,
        againstNumber: i.againstNumber,
        href: `/invoice/${i.publicToken}`,
      });
    }
  }
  return rows.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime()).slice(0, limit);
}

export async function invoiceByToken(token: string) {
  const db = await getDb();
  const [row] = await db.select().from(invoices).where(eq(invoices.publicToken, token));
  return row ?? null;
}

export async function invoicesForSubscription(subscriptionId: string) {
  const db = await getDb();
  return db.select().from(invoices).where(eq(invoices.subscriptionId, subscriptionId)).orderBy(desc(invoices.issuedAt));
}
