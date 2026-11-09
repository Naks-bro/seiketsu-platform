import "server-only";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { getDb, invoices, storeSettings, subscriptionPayments, subscriptionPlans, subscriptions, type Db, type TaxSnapshot } from "@seiketsu/db";
import { canRenew, creditFor, priceWithTax, renewCycle } from "@seiketsu/core/invoices";
import { endDateFor, istToday } from "@seiketsu/core/subscriptions";
import { getStore } from "./catalog";
import { env } from "./env";
import { gateway, type GatewayPayment } from "./gateway";
import { issueInvoice } from "./invoices";
import { audit } from "./audit";
import { OrderError, type PaymentParams } from "./orders";
import { rateLimit } from "./rate-limit";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Sub = typeof subscriptions.$inferSelect;
type SubPayment = typeof subscriptionPayments.$inferSelect;
export type SubPaymentKind = "first" | "renewal";

/** What the next payment for this subscription is for, if one can be taken now. */
export function nextPaymentKind(sub: Sub): SubPaymentKind | null {
  if (!sub.paidAt) return ["pending", "active"].includes(sub.status) ? "first" : null;
  return canRenew(sub.status, true) ? "renewal" : null;
}

async function taxFor(outletId: string): Promise<TaxSnapshot> {
  const db = await getDb();
  const store = await getStore(outletId);
  const [s] = await db.select({ gstin: storeSettings.gstin }).from(storeSettings).where(eq(storeSettings.outletId, outletId));
  return { ...store.pricing.tax, gstin: s?.gstin ?? null };
}

/** A renewal charges the plan as it is today when it is still on sale; otherwise the terms the customer signed up on. */
async function cycleTerms(sub: Sub, kind: SubPaymentKind) {
  if (kind === "renewal") {
    const db = await getDb();
    const [plan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.id, sub.planId), eq(subscriptionPlans.isActive, true)));
    if (plan) return { pricePaise: plan.pricePaise, meals: plan.mealsTotal, days: plan.durationDays };
  }
  return { pricePaise: sub.pricePaise, meals: sub.mealsTotal, days: sub.durationDays };
}

const longDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The charged amount already includes any tax; split it back out for the invoice. */
function splitCharged(amountPaise: number, tax: TaxSnapshot) {
  if (!tax.enabled || tax.rateBps <= 0) return { taxablePaise: amountPaise, taxPaise: 0, totalPaise: amountPaise };
  const taxable = Math.round((amountPaise * 10000) / (10000 + tax.rateBps));
  return { taxablePaise: taxable, taxPaise: amountPaise - taxable, totalPaise: amountPaise };
}

/** Starts (or reuses) the Razorpay order for a subscription's next payment. */
export async function startSubscriptionPayment(token: string): Promise<PaymentParams & { kind: SubPaymentKind }> {
  if (env.paymentsMode === "disabled") throw new OrderError("Online payment is not set up yet.", 503);
  const db = await getDb();
  const [found] = await db.select().from(subscriptions).where(eq(subscriptions.publicToken, token));
  if (!found) throw new OrderError("Subscription not found.", 404);
  const kind = nextPaymentKind(found);
  if (!kind) throw new OrderError("There is nothing to pay on this subscription right now.", 409);
  const tax = await taxFor(found.outletId);
  const terms = await cycleTerms(found, kind);
  const amountPaise = priceWithTax(terms.pricePaise, tax).totalPaise;

  return db.transaction(async (tx) => {
    const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.id, found.id)).for("update");
    // A recent unpaid attempt for the same amount is reused, so a double tap never opens two orders.
    let [p] = await tx
      .select()
      .from(subscriptionPayments)
      .where(
        and(
          eq(subscriptionPayments.subscriptionId, sub.id),
          eq(subscriptionPayments.kind, kind),
          eq(subscriptionPayments.amountPaise, amountPaise),
          inArray(subscriptionPayments.status, ["created", "failed"]),
          gt(subscriptionPayments.createdAt, new Date(Date.now() - 12 * 3600_000)),
        ),
      )
      .orderBy(desc(subscriptionPayments.createdAt))
      .limit(1);
    if (!p) {
      let gw;
      try {
        gw = await gateway().createOrder({
          amountPaise,
          receipt: `SUB-${sub.id.slice(0, 8)}-${Date.now().toString(36)}`,
          notes: { subscription_id: sub.id, kind, plan: sub.planName.slice(0, 60) },
        });
      } catch (err) {
        console.error("[subscription] gateway order failed", err);
        throw new OrderError("We could not start the payment. Please try again in a minute.", 502);
      }
      [p] = await tx
        .insert(subscriptionPayments)
        .values({ subscriptionId: sub.id, outletId: sub.outletId, kind, razorpayOrderId: gw.id, amountPaise, cycleMeals: terms.meals, cycleDays: terms.days, taxSnapshot: tax })
        .returning();
    }
    return {
      kind,
      mode: env.paymentsMode as "razorpay" | "simulator",
      keyId: env.razorpay.keyId ?? null,
      razorpayOrderId: p.razorpayOrderId!,
      amountPaise: p.amountPaise,
      prefill: { name: sub.name, contact: `+91${sub.phone}`, email: sub.email ?? undefined },
    };
  });
}

/** Applies a paid cycle to the subscription and issues its invoice. Runs inside the payment's lock. */
type Issuer = { name: string; addressLines: string[]; phone: string | null };

async function issuerFor(outletId: string): Promise<Issuer> {
  const store = await getStore(outletId);
  return { name: store.name, addressLines: store.addressLines, phone: store.phone };
}

/** Store details are read before the transaction: a second connection inside it can wait on its own lock. */
async function applyPaid(tx: Tx, p: SubPayment, at: Date, staffId: string | null, issuer: Issuer) {
  const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.id, p.subscriptionId)).for("update");
  const today = istToday(at);
  const patch: Partial<Sub> = {};
  if (p.kind === "first") {
    patch.paidAt = at;
    patch.paymentNote = p.provider === "offline" ? p.note : "Paid online";
    if (sub.status === "pending" && p.provider !== "offline") {
      // Paying online confirms the plan; it starts on the chosen day, or today if that has passed.
      const start = sub.startDate < today ? today : sub.startDate;
      Object.assign(patch, { status: "active", startDate: start, endDate: endDateFor(start, sub.durationDays) });
    }
  } else {
    Object.assign(patch, renewCycle(sub, { mealsTotal: p.cycleMeals, durationDays: p.cycleDays }, today));
  }
  const [updated] = await tx.update(subscriptions).set(patch).where(eq(subscriptions.id, sub.id)).returning();
  const amounts = splitCharged(p.amountPaise, p.taxSnapshot);
  await issueInvoice(tx, {
    outletId: sub.outletId,
    kind: "subscription",
    at,
    to: { name: sub.name, phone: sub.phone, email: sub.email, address: [sub.address, sub.pincode].filter(Boolean).join(", ") },
    issuer,
    lines: [
      {
        label: `${sub.planName}${p.kind === "renewal" ? " (renewal)" : ""}`,
        detail: `${p.cycleMeals} meal${p.cycleMeals === 1 ? "" : "s"} over ${p.cycleDays} day${p.cycleDays === 1 ? "" : "s"} · ${longDay(updated.startDate)} to ${updated.endDate ? longDay(updated.endDate) : "—"}`,
        quantity: 1,
        amountPaise: amounts.taxablePaise,
      },
    ],
    amounts,
    tax: p.taxSnapshot,
    subscriptionId: sub.id,
    subscriptionPaymentId: p.id,
    paymentMethod: p.provider === "offline" ? (p.note ?? "Offline") : p.method,
  });
  await audit(tx, { actorId: staffId, outletId: sub.outletId, action: `subscription.${p.kind}_paid`, entity: "subscription", entityId: sub.id, data: { paymentId: p.id, amount: p.amountPaise, provider: p.provider } });
  return updated;
}

/** Idempotent: verify, webhook and reconciliation may all report the same payment. */
export async function markSubscriptionCaptured(args: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number | null;
  method: string | null;
  feePaise?: number | null;
  feeTaxPaise?: number | null;
  via: "verify" | "webhook" | "reconcile";
}) {
  const db = await getDb();
  const [known] = await db.select({ outletId: subscriptionPayments.outletId }).from(subscriptionPayments).where(eq(subscriptionPayments.razorpayOrderId, args.razorpayOrderId));
  if (!known) throw new OrderError("Unknown payment.", 404);
  const issuer = await issuerFor(known.outletId);
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(subscriptionPayments).where(eq(subscriptionPayments.razorpayOrderId, args.razorpayOrderId)).for("update");
    if (!p) throw new OrderError("Unknown payment.", 404);
    if (p.status === "captured" || p.status === "refunded") return { changed: false, paymentId: p.id };
    if (args.amountPaise !== null && args.amountPaise !== p.amountPaise) {
      await tx.update(subscriptionPayments).set({ errorCode: "AMOUNT_MISMATCH", errorDescription: `Expected ${p.amountPaise}, got ${args.amountPaise}` }).where(eq(subscriptionPayments.id, p.id));
      await audit(tx, { actorId: null, outletId: p.outletId, action: "subscription.amount_mismatch", entity: "subscription", entityId: p.subscriptionId, data: args });
      return { changed: false, paymentId: p.id };
    }
    const at = new Date();
    const [captured] = await tx
      .update(subscriptionPayments)
      .set({ status: "captured", razorpayPaymentId: args.razorpayPaymentId, method: args.method, feePaise: args.feePaise ?? null, feeTaxPaise: args.feeTaxPaise ?? null, errorCode: null, errorDescription: null, paidAt: at })
      .where(eq(subscriptionPayments.id, p.id))
      .returning();
    await applyPaid(tx, captured, at, null, issuer);
    return { changed: true, paymentId: p.id };
  });
}

export async function markSubscriptionFailed(args: { razorpayOrderId: string; code?: string | null; description?: string | null }) {
  const db = await getDb();
  await db
    .update(subscriptionPayments)
    .set({ status: "failed", errorCode: args.code ?? null, errorDescription: args.description ?? null })
    .where(and(eq(subscriptionPayments.razorpayOrderId, args.razorpayOrderId), inArray(subscriptionPayments.status, ["created", "failed"])));
}

export async function isSubscriptionOrder(razorpayOrderId: string | null | undefined) {
  if (!razorpayOrderId) return false;
  const db = await getDb();
  const [row] = await db.select({ id: subscriptionPayments.id }).from(subscriptionPayments).where(eq(subscriptionPayments.razorpayOrderId, razorpayOrderId));
  return !!row;
}

/** After Razorpay Checkout returns: the route checked the signature; confirm the real state with Razorpay. */
export async function confirmSubscriptionPayment(args: { token: string; razorpayOrderId: string; razorpayPaymentId: string }) {
  const db = await getDb();
  const [row] = await db
    .select({ p: subscriptionPayments })
    .from(subscriptionPayments)
    .innerJoin(subscriptions, eq(subscriptions.id, subscriptionPayments.subscriptionId))
    .where(and(eq(subscriptionPayments.razorpayOrderId, args.razorpayOrderId), eq(subscriptions.publicToken, args.token)));
  if (!row) throw new OrderError("Payment does not match this subscription.", 400);
  if (env.paymentsMode === "simulator") {
    await markSubscriptionCaptured({ ...args, amountPaise: row.p.amountPaise, method: "simulator", via: "verify" });
    return "paid";
  }
  let gp: GatewayPayment | null = await gateway().fetchPayment(args.razorpayPaymentId);
  if (!gp || gp.orderId !== args.razorpayOrderId) throw new OrderError("Payment could not be confirmed.", 400);
  if (gp.status === "authorized") gp = await gateway().capture(gp.id, gp.amountPaise);
  if (gp.status !== "captured") return "pending";
  await markSubscriptionCaptured({ ...args, amountPaise: gp.amountPaise, method: gp.method, feePaise: gp.feePaise, feeTaxPaise: gp.feeTaxPaise, via: "verify" });
  return "paid";
}

/** Catches payments whose browser closed before verify and whose webhook was missed. */
export async function reconcileSubscriptionPayments(limit = 25, deadline = Infinity) {
  if (env.paymentsMode !== "razorpay") return 0;
  const db = await getDb();
  const open = await db
    .select()
    .from(subscriptionPayments)
    .where(and(eq(subscriptionPayments.provider, "razorpay"), inArray(subscriptionPayments.status, ["created", "failed"]), gt(subscriptionPayments.createdAt, new Date(Date.now() - 2 * 86400_000))))
    .orderBy(asc(subscriptionPayments.updatedAt))
    .limit(limit);
  let found = 0;
  for (const p of open) {
    if (Date.now() >= deadline) break;
    if (!(await rateLimit(`sub-reconcile:${p.id}`, 1, 300))) continue;
    await db.update(subscriptionPayments).set({ updatedAt: new Date() }).where(eq(subscriptionPayments.id, p.id));
    const remote = await gateway().orderPayments(p.razorpayOrderId!).catch(() => []);
    const captured = remote.find((r) => r.status === "captured");
    if (captured) {
      await markSubscriptionCaptured({ razorpayOrderId: p.razorpayOrderId!, razorpayPaymentId: captured.id, amountPaise: captured.amountPaise, method: captured.method, feePaise: captured.feePaise, feeTaxPaise: captured.feeTaxPaise, via: "reconcile" });
      found++;
    }
  }
  return found;
}

/**
 * A refund made from the Razorpay dashboard on a subscription payment. Returns
 * false when the payment isn't a subscription's, so the order code can handle it.
 */
export async function subscriptionRefundProcessed(args: { razorpayPaymentId: string; refundId: string; amountPaise: number; status: string }) {
  const db = await getDb();
  const [p0] = await db.select({ id: subscriptionPayments.id }).from(subscriptionPayments).where(eq(subscriptionPayments.razorpayPaymentId, args.razorpayPaymentId));
  if (!p0) return false;
  if (args.status !== "processed") return true;
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, p0.id)).for("update");
    const [done] = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.refundRef, args.refundId));
    if (done) return;
    const refunded = Math.min(p.amountPaise, p.refundedPaise + args.amountPaise);
    await tx.update(subscriptionPayments).set({ refundedPaise: refunded, status: refunded >= p.amountPaise ? "refunded" : "captured" }).where(eq(subscriptionPayments.id, p.id));
    const [inv] = await tx.select().from(invoices).where(and(eq(invoices.subscriptionPaymentId, p.id), eq(invoices.kind, "subscription")));
    if (!inv) return;
    const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.id, p.subscriptionId));
    const amounts = creditFor(Math.min(args.amountPaise, inv.totalPaise), inv);
    await issueInvoice(tx, {
      outletId: p.outletId,
      kind: "credit_note",
      at: new Date(),
      to: { name: inv.customerName, phone: inv.customerPhone, email: inv.customerEmail, address: inv.billingAddress },
      issuer: inv.issuer,
      lines: [{ label: `Refund against ${inv.number}`, detail: sub?.planName ?? null, quantity: 1, amountPaise: amounts.taxablePaise }],
      amounts,
      tax: inv.taxSnapshot,
      subscriptionId: p.subscriptionId,
      subscriptionPaymentId: p.id,
      againstNumber: inv.number,
      refundRef: args.refundId,
    });
    await audit(tx, { actorId: null, outletId: p.outletId, action: "subscription.refunded", entity: "subscription", entityId: p.subscriptionId, data: { amount: args.amountPaise, refundId: args.refundId } });
  });
  return true;
}

/** Cash or UPI taken by staff. The first payment marks the plan paid; a later one adds a cycle. */
export async function recordOfflinePayment(outletId: string, subscriptionId: string, args: { note: string | null; staffId: string | null }) {
  const db = await getDb();
  const [sub] = await db.select().from(subscriptions).where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.outletId, outletId)));
  if (!sub) throw new OrderError("Subscription not found.", 404);
  const kind = nextPaymentKind(sub) ?? (sub.paidAt ? null : "first");
  if (!kind) throw new OrderError("This subscription can't take a payment in its current state.", 409);
  const tax = await taxFor(outletId);
  const terms = await cycleTerms(sub, kind);
  const amountPaise = priceWithTax(terms.pricePaise, tax).totalPaise;
  const issuer = await issuerFor(outletId);
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).for("update");
    if (kind === "first" && locked.paidAt) return null;
    const at = new Date();
    const [p] = await tx
      .insert(subscriptionPayments)
      .values({ subscriptionId: sub.id, outletId, kind, provider: "offline", amountPaise, status: "captured", method: "offline", note: args.note, cycleMeals: terms.meals, cycleDays: terms.days, taxSnapshot: tax, paidAt: at, staffId: args.staffId })
      .returning();
    return applyPaid(tx, p, at, args.staffId, issuer);
  });
}

export async function paymentsForSubscription(subscriptionId: string) {
  const db = await getDb();
  return db.select().from(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, subscriptionId)).orderBy(desc(subscriptionPayments.createdAt));
}

/** What the customer would pay for the next cycle, tax included, for showing on the page. */
export async function nextPaymentQuote(sub: Sub) {
  const kind = nextPaymentKind(sub);
  if (!kind) return null;
  const terms = await cycleTerms(sub, kind);
  return { kind, ...terms, amountPaise: priceWithTax(terms.pricePaise, await taxFor(sub.outletId)).totalPaise };
}
