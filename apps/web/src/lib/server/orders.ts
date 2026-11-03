import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import {
  addonGroups,
  addons,
  customers,
  consentEvents,
  couponRedemptions,
  getDb,
  invoiceCounters,
  menuItemAddonGroups,
  menuItems,
  menuItemVariants,
  orderEvents,
  orderItemAddons,
  orderItems,
  orders,
  outletMenuItems,
  payments,
  refunds,
  type Db,
} from "@seiketsu/db";
import { cartLineSchema, indianMobile, type CheckoutData } from "@seiketsu/core/checkout-schema";
import { z } from "zod";
import { checkTransition, REFUND_ON, type OrderStatus } from "@seiketsu/core/order-status";
import { computeQuote } from "@seiketsu/core/pricing";
import { isServiceable } from "@seiketsu/core/delivery-area";
import { evaluateCoupon, loyaltySettings, pointsForPhone, redeemable, reverseLoyalty, settleLoyalty } from "./rewards";
import { eventForStatus, financialYear, formatInvoiceNumber, type CustomerEvent } from "@seiketsu/core/messaging";
import { getStore } from "./catalog";
import { env } from "./env";
import { gateway, type GatewayPayment } from "./gateway";
import { publish, topics } from "./realtime";
import { audit } from "./audit";
import { runAfter } from "./after";
import { notifyCustomer } from "./notify-customer";
import { rateLimit } from "./rate-limit";
import { deductStockSafely, returnStockForOrder } from "./inventory";

export class OrderError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const newToken = () => randomBytes(24).toString("base64url");

async function notify(
  order: { id: string; publicToken: string; outletId: string; status: OrderStatus },
  customerEvent?: CustomerEvent | null,
  extra?: { amountPaise?: number },
) {
  await Promise.all([
    publish(topics.order(order.publicToken), "status", { status: order.status }),
    publish(topics.outlet(order.outletId), "orders_changed"),
  ]);
  // WhatsApp/SMS goes out after the response so a slow provider never delays checkout or the kitchen.
  if (customerEvent) runAfter(() => notifyCustomer(order.id, customerEvent, extra));
}

/** Next bill number for the financial year; the counter row lock keeps numbers gap-free. */
async function nextInvoiceNumber(tx: Tx, at: Date) {
  const fy = financialYear(at);
  const [c] = await tx
    .insert(invoiceCounters)
    .values({ financialYear: fy, last: 1 })
    .onConflictDoUpdate({ target: invoiceCounters.financialYear, set: { last: sql`${invoiceCounters.last} + 1` } })
    .returning();
  return formatInvoiceNumber("SK", fy, c.last);
}

type CartLine = CheckoutData["lines"][number];

/**
 * Looks up every cart line in the database (never trusting client prices) and
 * checks availability and allowed extras. Shared by online checkout and the counter.
 */
async function resolveLines(db: Db, inputLines: CartLine[], outletId: string) {
  const input = { lines: inputLines };
  const variantIds = [...new Set(input.lines.map((l) => l.variantId))];
  const rows = await db
    .select({ v: menuItemVariants, item: menuItems, avail: outletMenuItems.isAvailable })
    .from(menuItemVariants)
    .innerJoin(menuItems, eq(menuItems.id, menuItemVariants.menuItemId))
    .innerJoin(
      outletMenuItems,
      and(eq(outletMenuItems.menuItemId, menuItems.id), eq(outletMenuItems.outletId, outletId)),
    )
    .where(inArray(menuItemVariants.id, variantIds));
  const byVariant = new Map(rows.map((r) => [r.v.id, r]));

  const addonIds = [...new Set(input.lines.flatMap((l) => l.addOnIds))];
  const addonRows = addonIds.length ? await db.select().from(addons).where(inArray(addons.id, addonIds)) : [];
  const addonById = new Map(addonRows.map((a) => [a.id, a]));
  const itemIds = [...new Set(input.lines.map((l) => l.menuItemId))];
  const links = await db.select().from(menuItemAddonGroups).where(inArray(menuItemAddonGroups.menuItemId, itemIds));
  const usedGroups = [...new Set(addonRows.map((a) => a.groupId))];
  const groupMax = new Map(
    (usedGroups.length ? await db.select().from(addonGroups).where(inArray(addonGroups.id, usedGroups)) : []).map((g) => [g.id, g.maxSelect]),
  );

  return input.lines.map((line) => {
    const r = byVariant.get(line.variantId);
    if (!r || r.item.id !== line.menuItemId || !r.v.isActive) throw new OrderError("An item in your cart is no longer on the menu.", 409);
    if (!r.avail || r.item.needsReview || r.item.deletedAt) throw new OrderError(`${r.item.name} is sold out right now.`, 409);
    const allowedGroups = new Set(links.filter((l) => l.menuItemId === r.item.id).map((l) => l.groupId));
    const chosen = [...new Set(line.addOnIds)].map((id) => {
      const a = addonById.get(id);
      if (!a || !allowedGroups.has(a.groupId)) throw new OrderError(`An extra is not available for ${r.item.name}.`, 409);
      if (!a.isAvailable) throw new OrderError(`${a.name} is sold out right now.`, 409);
      return a;
    });
    for (const g of new Set(chosen.map((a) => a.groupId))) {
      const max = groupMax.get(g);
      if (max !== undefined && chosen.filter((a) => a.groupId === g).length > max) throw new OrderError(`Too many extras from one group for ${r.item.name}.`, 400);
    }
    return { line, item: r.item, variant: r.v, addons: chosen };
  });
}

function quoteFor(lines: Awaited<ReturnType<typeof resolveLines>>, pricing: Parameters<typeof computeQuote>[1], fulfilment: "pickup" | "delivery", discountPaise = 0) {
  return computeQuote(
    lines.map((l) => ({ unitPricePaise: l.variant.pricePaise, addOnPricesPaise: l.addons.map((a) => a.pricePaise), quantity: l.line.quantity })),
    pricing,
    fulfilment,
    discountPaise,
  );
}

type Rewards = { couponId: string | null; couponCode: string | null; couponPaise: number; points: number; pointsPaise: number };

/**
 * Coupon and points for an order, worked out on the server from the database. A code that can't be used throws
 * with the reason. Points are only spent for the signed-in customer's own phone number.
 */
async function rewardsFor(outletId: string, subtotalPaise: number, phone: string, couponCode: string | undefined, usePoints: boolean | undefined, sessionPhone: string | null): Promise<Rewards> {
  const r: Rewards = { couponId: null, couponCode: null, couponPaise: 0, points: 0, pointsPaise: 0 };
  if (couponCode?.trim()) {
    const c = await evaluateCoupon(outletId, couponCode, phone, subtotalPaise);
    if ("error" in c) throw new OrderError(c.error ?? "That coupon can’t be used.", 400);
    r.couponId = c.coupon.id;
    r.couponCode = c.coupon.code;
    r.couponPaise = c.discountPaise;
  }
  if (usePoints && sessionPhone && sessionPhone === phone) {
    const mine = await pointsForPhone(phone);
    if (mine) {
      const spend = redeemable(mine.balance, subtotalPaise - r.couponPaise, await loyaltySettings(outletId));
      r.points = spend.points;
      r.pointsPaise = spend.valuePaise;
    }
  }
  return r;
}

/** What the checkout page shows before paying: the coupon's effect and the points the customer could spend. */
export async function previewRewards(args: { lines: CheckoutData["lines"]; phone: string | null; couponCode?: string; sessionPhone: string | null }) {
  const store = await getStore();
  const db = await getDb();
  const lines = await resolveLines(db, args.lines, store.outletId);
  const subtotalPaise = quoteFor(lines, store.pricing, "pickup").subtotalPaise;
  const out = { couponPaise: 0, couponCode: null as string | null, couponError: null as string | null, loyalty: null as null | { balance: number; points: number; valuePaise: number } };
  if (args.couponCode?.trim()) {
    const c = await evaluateCoupon(store.outletId, args.couponCode, args.phone ?? "", subtotalPaise);
    if ("error" in c) out.couponError = c.error ?? null;
    else {
      out.couponPaise = c.discountPaise;
      out.couponCode = c.coupon.code;
    }
  }
  const settings = await loyaltySettings(store.outletId);
  if (settings.enabled && args.sessionPhone) {
    const mine = await pointsForPhone(args.sessionPhone);
    const balance = mine?.balance ?? 0;
    out.loyalty = { balance, ...redeemable(balance, subtotalPaise - out.couponPaise, settings) };
  }
  return out;
}

const variantLabel = (v: { label: string | null; portionAmount: number | null; portionUnit: string | null }) =>
  [v.label, v.portionAmount ? `{v.portionAmount}{v.portionUnit}` : null].filter(Boolean).join(" ") || null;

// ── Checkout ───────────────────────────────────────────────────────

export type CheckoutResult = {
  token: string;
  orderNumber: string;
  totalPaise: number;
  payment: PaymentParams;
};

export type PaymentParams = {
  mode: "razorpay" | "simulator";
  keyId: string | null;
  razorpayOrderId: string;
  amountPaise: number;
  prefill: { name: string; contact: string; email?: string };
};

export async function createCheckout(input: CheckoutData, opts: { sessionPhone?: string | null } = {}): Promise<CheckoutResult> {
  if (env.paymentsMode === "disabled") {
    throw new OrderError("Online payment is not set up yet. Please order on WhatsApp for now.", 503);
  }
  const store = await getStore();
  if (!store.isOpenNow) throw new OrderError("We are not taking online orders right now.", 409);
  if (input.fulfilment === "pickup" && !store.pickupEnabled) throw new OrderError("Pickup is not available right now.");
  if (input.fulfilment === "delivery") {
    if (!store.deliveryEnabled) throw new OrderError("Delivery is not available right now.");
    const pin = input.address!.pincode;
    if (!isServiceable(pin, store.deliveryPincodes)) {
      throw new OrderError(`Sorry, we do not deliver to ${pin} yet.`);
    }
  }

  const db = await getDb();
  const lines = await resolveLines(db, input.lines, store.outletId);

  let quote = quoteFor(lines, store.pricing, input.fulfilment);
  if (quote.belowMinimum) {
    throw new OrderError(`Minimum order is \u20b9${store.pricing.minOrderPaise / 100}.`);
  }
  const rewards = await rewardsFor(store.outletId, quote.subtotalPaise, input.customer.phone, input.couponCode, input.usePoints, opts.sessionPhone ?? null);
  if (rewards.couponPaise + rewards.pointsPaise > 0) quote = quoteFor(lines, store.pricing, input.fulfilment, rewards.couponPaise + rewards.pointsPaise);

  const settings = await db.query.storeSettings.findFirst({ where: (s, { eq }) => eq(s.outletId, store.outletId) });
  const expiresAt = new Date(Date.now() + (settings?.paymentExpiryMinutes ?? 30) * 60_000);
  const email = input.customer.email || null;

  const order = await db.transaction(async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({ phone: input.customer.phone, name: input.customer.name, email })
      .onConflictDoUpdate({ target: customers.phone, set: { name: input.customer.name, ...(email ? { email } : {}) } })
      .returning();
    // Ticking a box opts in; leaving it unticked never removes an earlier opt-in.
    const optIns = [
      input.marketing?.whatsapp && !customer.marketingWhatsapp ? ("whatsapp" as const) : null,
      input.marketing?.email && email && !customer.marketingEmail ? ("email" as const) : null,
    ].filter((c) => c !== null);
    if (optIns.length) {
      await tx
        .update(customers)
        .set({
          ...(optIns.includes("whatsapp") ? { marketingWhatsapp: true } : {}),
          ...(optIns.includes("email") ? { marketingEmail: true } : {}),
        })
        .where(eq(customers.id, customer.id));
      await tx.insert(consentEvents).values(optIns.map((channel) => ({ customerId: customer.id, channel, granted: true, source: "checkout" })));
    }
    const [o] = await tx
      .insert(orders)
      .values({
        outletId: store.outletId,
        publicToken: newToken(),
        customerId: customer.id,
        customerName: input.customer.name,
        customerPhone: input.customer.phone,
        customerEmail: email,
        source: input.source,
        fulfilment: input.fulfilment,
        address: input.fulfilment === "delivery" ? input.address! : null,
        notes: input.notes || null,
        subtotalPaise: quote.subtotalPaise,
        discountPaise: quote.discountPaise,
        couponCode: rewards.couponCode,
        loyaltyPointsUsed: rewards.points,
        deliveryFeePaise: quote.deliveryFeePaise,
        taxPaise: quote.taxPaise,
        totalPaise: quote.totalPaise,
        taxSnapshot: { ...store.pricing.tax, gstin: settings?.gstin ?? null },
        expiresAt,
      })
      .returning();
    if (rewards.couponId) {
      await tx.insert(couponRedemptions).values({ couponId: rewards.couponId, orderId: o.id, customerPhone: input.customer.phone, discountPaise: rewards.couponPaise });
    }

    for (const [i, l] of lines.entries()) {
      const [oi] = await tx
        .insert(orderItems)
        .values({
          orderId: o.id,
          menuItemId: l.item.id,
          variantId: l.variant.id,
          itemName: l.item.name,
          variantLabel: variantLabel(l.variant),
          diet: l.variant.diet ?? l.item.diet,
          unitPricePaise: l.variant.pricePaise,
          quantity: l.line.quantity,
          lineTotalPaise: quote.lineTotalsPaise[i],
          note: l.line.note || null,
        })
        .returning();
      if (l.addons.length) {
        await tx.insert(orderItemAddons).values(
          l.addons.map((a) => ({ orderItemId: oi.id, addonId: a.id, name: a.name, pricePaise: a.pricePaise })),
        );
      }
    }
    await tx.insert(orderEvents).values({ orderId: o.id, fromStatus: null, toStatus: "pending_payment", actorType: "customer" });
    return o;
  });

  const payment = await openPayment(order);
  return { token: order.publicToken, orderNumber: order.orderNumber, totalPaise: order.totalPaise, payment };
}

/** Creates (or reuses) the gateway order for an unpaid order. */
async function openPayment(order: typeof orders.$inferSelect): Promise<PaymentParams> {
  const db = await getDb();
  let [p] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, order.id), inArray(payments.status, ["created", "failed"])))
    .limit(1);
  if (!p) {
    let gw;
    try {
      gw = await gateway().createOrder({
        amountPaise: order.totalPaise,
        receipt: order.orderNumber,
        notes: { order_id: order.id, order_number: order.orderNumber },
      });
    } catch (err) {
      console.error("[checkout] gateway order failed", err);
      throw new OrderError("We could not start the payment. Please try again in a minute.", 502);
    }
    [p] = await db
      .insert(payments)
      .values({ orderId: order.id, razorpayOrderId: gw.id, amountPaise: order.totalPaise })
      .returning();
  }
  return {
    mode: env.paymentsMode as "razorpay" | "simulator",
    keyId: env.razorpay.keyId ?? null,
    razorpayOrderId: p.razorpayOrderId!,
    amountPaise: p.amountPaise,
    prefill: { name: order.customerName, contact: `+91${order.customerPhone}`, email: order.customerEmail ?? undefined },
  };
}

/** For the "Pay now" button on an unpaid order. */
export async function resumePayment(token: string): Promise<PaymentParams> {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.publicToken, token));
  if (!order) throw new OrderError("Order not found.", 404);
  if (!["pending_payment", "payment_failed"].includes(order.status)) throw new OrderError("This order is not awaiting payment.", 409);
  if (order.expiresAt && order.expiresAt < new Date()) throw new OrderError("This order has expired. Please place a new order.", 410);
  return openPayment(order);
}

// ── Payment results (idempotent) ───────────────────────────────────

async function lockPayment(tx: Tx, razorpayOrderId: string) {
  const [p] = await tx.select().from(payments).where(eq(payments.razorpayOrderId, razorpayOrderId)).for("update");
  if (!p) throw new OrderError("Unknown payment.", 404);
  const [o] = await tx.select().from(orders).where(eq(orders.id, p.orderId)).for("update");
  return { p, o };
}

/**
 * Marks a payment captured and moves the order into the kitchen flow.
 * Called by checkout verify, the webhook and reconciliation; whichever runs
 * second finds the work done and changes nothing.
 */
export async function markPaymentCaptured(args: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number | null;
  method: string | null;
  via: "verify" | "webhook" | "reconcile";
  feePaise?: number | null;
  feeTaxPaise?: number | null;
}) {
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const { p, o } = await lockPayment(tx, args.razorpayOrderId);
    if (p.status === "captured" || p.status === "refunded") return { order: o, changed: false };
    if (args.amountPaise !== null && args.amountPaise !== p.amountPaise) {
      // Never accept a payment for a different amount; leave it for staff to review.
      await tx
        .update(payments)
        .set({ errorCode: "AMOUNT_MISMATCH", errorDescription: `Expected ${p.amountPaise}, got ${args.amountPaise}` })
        .where(eq(payments.id, p.id));
      await audit(tx, { actorId: null, outletId: o.outletId, action: "payment.amount_mismatch", entity: "order", entityId: o.id, data: args });
      return { order: o, changed: false };
    }
    await tx
      .update(payments)
      .set({
        status: "captured",
        razorpayPaymentId: args.razorpayPaymentId,
        method: args.method,
        feePaise: args.feePaise ?? null,
        feeTaxPaise: args.feeTaxPaise ?? null,
        errorCode: null,
        errorDescription: null,
      })
      .where(eq(payments.id, p.id));

    if (checkTransition({ from: o.status, to: "placed", actor: "system", fulfilment: o.fulfilment }).ok) {
      const [u] = await tx
        .update(orders)
        .set({ status: "placed", paymentState: "paid", placedAt: new Date(), invoiceNumber: o.invoiceNumber ?? (await nextInvoiceNumber(tx, new Date())) })
        .where(eq(orders.id, o.id))
        .returning();
      await tx.insert(orderEvents).values({
        orderId: o.id,
        fromStatus: o.status,
        toStatus: "placed",
        actorType: "system",
        note: `Payment captured (${args.via})`,
      });
      return { order: u, changed: true };
    }
    await tx.update(orders).set({ paymentState: "paid" }).where(eq(orders.id, o.id));
    return { order: o, changed: false };
  });
  if (result.changed) {
    await deductStockSafely(result.order.id);
    // Points never hold up an order: a failure here is logged and can be put right by hand in Customers.
    await settleLoyalty(result.order.id).catch((err) => console.error("[loyalty] could not settle", result.order.id, err));
    await notify(result.order, "placed");
  }
  return result.order;
}

export async function markPaymentFailed(args: { razorpayOrderId: string; code?: string | null; description?: string | null }) {
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const { p, o } = await lockPayment(tx, args.razorpayOrderId);
    if (p.status === "captured" || p.status === "refunded") return { order: o, changed: false };
    await tx
      .update(payments)
      .set({ status: "failed", errorCode: args.code ?? null, errorDescription: args.description ?? null })
      .where(eq(payments.id, p.id));
    if (o.status === "pending_payment") {
      const [u] = await tx.update(orders).set({ status: "payment_failed" }).where(eq(orders.id, o.id)).returning();
      await tx.insert(orderEvents).values({ orderId: o.id, fromStatus: o.status, toStatus: "payment_failed", actorType: "system", note: args.description ?? null });
      return { order: u, changed: true };
    }
    return { order: o, changed: false };
  });
  if (result.changed) await notify(result.order);
  return result.order;
}

/** Confirms a checkout payment after the browser handler returns. */
export async function confirmCheckoutPayment(args: { token: string; razorpayOrderId: string; razorpayPaymentId: string }) {
  const db = await getDb();
  const [row] = await db
    .select({ o: orders, p: payments })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(payments.razorpayOrderId, args.razorpayOrderId), eq(orders.publicToken, args.token)));
  if (!row) throw new OrderError("Payment does not match this order.", 400);

  if (env.paymentsMode === "simulator") {
    return markPaymentCaptured({ ...args, amountPaise: row.p.amountPaise, method: "simulator", via: "verify" });
  }
  // Signature proves Razorpay authorised it; confirm the real state and capture if needed.
  let gp: GatewayPayment | null = await gateway().fetchPayment(args.razorpayPaymentId);
  if (!gp || gp.orderId !== args.razorpayOrderId) throw new OrderError("Payment could not be confirmed.", 400);
  if (gp.status === "authorized") gp = await gateway().capture(gp.id, gp.amountPaise);
  if (gp.status !== "captured") return row.o;
  return markPaymentCaptured({ ...args, amountPaise: gp.amountPaise, method: gp.method, feePaise: gp.feePaise, feeTaxPaise: gp.feeTaxPaise, via: "verify" });
}

// ── Reconciliation & expiry ────────────────────────────────────────

/** Re-checks an unpaid order with the gateway; expires it when its time is up. */
export async function reconcileOrder(order: typeof orders.$inferSelect) {
  if (!["pending_payment", "payment_failed", "expired"].includes(order.status)) return order;
  const db = await getDb();
  // Tracking pages poll every few seconds; ask Razorpay at most every 20s per order.
  if (env.paymentsMode === "razorpay" && (await rateLimit(`reconcile:${order.id}`, 1, 20))) {
    const ps = await db.select().from(payments).where(eq(payments.orderId, order.id));
    for (const p of ps) {
      if (!p.razorpayOrderId || p.status === "captured") continue;
      const remote = await gateway().orderPayments(p.razorpayOrderId).catch(() => []);
      const captured = remote.find((r) => r.status === "captured");
      if (captured) {
        return markPaymentCaptured({
          razorpayOrderId: p.razorpayOrderId,
          razorpayPaymentId: captured.id,
          amountPaise: captured.amountPaise,
          method: captured.method,
          feePaise: captured.feePaise,
          feeTaxPaise: captured.feeTaxPaise,
          via: "reconcile",
        });
      }
    }
  }
  if (order.status !== "expired" && order.expiresAt && order.expiresAt < new Date()) {
    const [u] = await db
      .update(orders)
      .set({ status: "expired" })
      .where(and(eq(orders.id, order.id), inArray(orders.status, ["pending_payment", "payment_failed"])))
      .returning();
    if (u) {
      await db.insert(orderEvents).values({ orderId: order.id, fromStatus: order.status, toStatus: "expired", actorType: "system" });
      return u;
    }
  }
  return order;
}

export async function reconcileStale(limit = 50) {
  const db = await getDb();
  const stale = await db
    .select()
    .from(orders)
    .where(
      or(
        and(inArray(orders.status, ["pending_payment", "payment_failed"]), lt(orders.createdAt, new Date(Date.now() - 2 * 60_000))),
        // Expired in the last day: catch payments that landed late.
        and(eq(orders.status, "expired"), gt(orders.expiresAt, new Date(Date.now() - 24 * 3600_000))),
      ),
    )
    .limit(limit);
  let changed = 0;
  for (const o of stale) {
    const u = await reconcileOrder(o);
    if (u.status !== o.status) changed++;
  }
  return { checked: stale.length, changed };
}

// ── Staff actions ──────────────────────────────────────────────────

export async function transitionOrder(args: { orderId: string; to: OrderStatus; staffId: string; outletId: string; reason?: string | null }) {
  const db = await getDb();
  const updated = await db.transaction(async (tx) => {
    const [o] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, args.orderId), eq(orders.outletId, args.outletId)))
      .for("update");
    if (!o) throw new OrderError("Order not found.", 404);
    const check = checkTransition({ from: o.status, to: args.to, actor: "staff", fulfilment: o.fulfilment, reason: args.reason });
    if (!check.ok) throw new OrderError(check.error, 409);
    const [u] = await tx
      .update(orders)
      .set({
        status: args.to,
        statusReason: REFUND_ON.includes(args.to) ? args.reason!.trim() : o.statusReason,
        completedAt: args.to === "completed" ? new Date() : o.completedAt,
      })
      .where(eq(orders.id, o.id))
      .returning();
    await tx.insert(orderEvents).values({
      orderId: o.id,
      fromStatus: o.status,
      toStatus: args.to,
      actorType: "staff",
      actorId: args.staffId,
      note: args.reason?.trim() || null,
    });
    await audit(tx, { actorId: args.staffId, outletId: o.outletId, action: `order.${args.to}`, entity: "order", entityId: o.id, data: { reason: args.reason ?? null } });
    return u;
  });
  if (args.to === "rejected") {
    // Rejected before the kitchen started, so the ingredients are still on the shelf.
    await returnStockForOrder(updated.id).catch((err) => console.error("[inventory] could not return stock", updated.id, err));
  }
  await notify(updated, eventForStatus(args.to, updated.fulfilment));
  return updated;
}

/** Full refund of the captured payment. Partial refunds come with the POS phase. */
export async function refundOrder(args: { orderId: string; staffId: string; outletId: string; reason: string }) {
  const db = await getDb();
  const [row] = await db
    .select({ o: orders, p: payments })
    .from(orders)
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .where(and(eq(orders.id, args.orderId), eq(orders.outletId, args.outletId), eq(payments.status, "captured")));
  if (!row) throw new OrderError("There is no captured payment to refund.", 409);
  if (!REFUND_ON.includes(row.o.status)) throw new OrderError("Reject or cancel the order before refunding.", 409);
  const amount = row.p.amountPaise - row.p.refundedPaise;
  if (amount <= 0) throw new OrderError("This payment is already refunded.", 409);

  // Counter sales (cash / UPI / card at the till) are refunded by hand; only online payments go back through Razorpay.
  const r =
    row.p.provider === "razorpay"
      ? await gateway().refund(row.p.razorpayPaymentId!, amount, { order_number: row.o.orderNumber, reason: args.reason.slice(0, 200) })
      : { id: null, status: "processed" };
  await db.transaction(async (tx) => {
    await tx.insert(refunds).values({ paymentId: row.p.id, razorpayRefundId: r.id, amountPaise: amount, status: r.status, reason: args.reason, createdBy: args.staffId });
    await tx.update(payments).set({ refundedPaise: row.p.refundedPaise + amount, status: "refunded" }).where(eq(payments.id, row.p.id));
    await tx.update(orders).set({ paymentState: "refunded" }).where(eq(orders.id, row.o.id));
    await audit(tx, { actorId: args.staffId, outletId: row.o.outletId, action: "order.refund", entity: "order", entityId: row.o.id, data: { amount, refundId: r.id } });
  });
  await reverseLoyalty(row.o.id).catch((err) => console.error("[loyalty] could not reverse", row.o.id, err));
  await notify(row.o, "refunded", { amountPaise: amount });
  return { refundId: r.id, amountPaise: amount, status: r.status };
}

export async function updateRefundStatus(razorpayRefundId: string, status: string) {
  const db = await getDb();
  await db.update(refunds).set({ status }).where(eq(refunds.razorpayRefundId, razorpayRefundId));
}
// ── Counter (POS) ──────────────────────────────────────────────────

export const posOrderSchema = z.object({
  lines: z.array(cartLineSchema).min(1, "Add something to the order").max(60),
  customerName: z.string().trim().max(80).optional(),
  phone: z.union([z.literal(""), indianMobile]).optional(),
  tableLabel: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(300).optional(),
  payment: z.enum(["cash", "upi", "card"]),
  /** cash handed over, in paise; used only to work out change */
  tenderedPaise: z.number().int().min(0).max(10_000_000).optional(),
});
export type PosOrderInput = z.input<typeof posOrderSchema>;

export const COUNTER_PROVIDER = { cash: "cash", upi: "counter_upi", card: "counter_card" } as const;

/**
 * A sale taken and paid at the counter. It is paid on creation and goes
 * straight to the kitchen; there is no online payment step.
 */
export async function createPosOrder(raw: unknown, staff: { id: string; outletId: string }) {
  const input = posOrderSchema.parse(raw);
  const store = await getStore();
  const db = await getDb();
  const lines = await resolveLines(db, input.lines, staff.outletId);
  const quote = quoteFor(lines, store.pricing, "pickup");
  if (input.payment === "cash" && input.tenderedPaise !== undefined && input.tenderedPaise < quote.totalPaise) {
    throw new OrderError("Cash received is less than the total.");
  }
  const settings = await db.query.storeSettings.findFirst({ where: (s, { eq }) => eq(s.outletId, staff.outletId) });
  const phone = input.phone || "";
  const name = input.customerName || "Walk-in";

  const order = await db.transaction(async (tx) => {
    const customerId = phone
      ? (
          await tx
            .insert(customers)
            .values({ phone, name })
            .onConflictDoUpdate({ target: customers.phone, set: input.customerName ? { name } : { phone } })
            .returning({ id: customers.id })
        )[0].id
      : null;
    const now = new Date();
    const [o] = await tx
      .insert(orders)
      .values({
        outletId: staff.outletId,
        publicToken: newToken(),
        customerId,
        customerName: name,
        customerPhone: phone,
        source: "pos",
        fulfilment: "pickup",
        status: "placed",
        paymentState: "paid",
        tableLabel: input.tableLabel || null,
        notes: input.notes || null,
        subtotalPaise: quote.subtotalPaise,
        discountPaise: quote.discountPaise,
        deliveryFeePaise: 0,
        taxPaise: quote.taxPaise,
        totalPaise: quote.totalPaise,
        taxSnapshot: { ...store.pricing.tax, gstin: settings?.gstin ?? null },
        placedAt: now,
        invoiceNumber: await nextInvoiceNumber(tx, now),
      })
      .returning();
    for (const [i, l] of lines.entries()) {
      const [oi] = await tx
        .insert(orderItems)
        .values({
          orderId: o.id,
          menuItemId: l.item.id,
          variantId: l.variant.id,
          itemName: l.item.name,
          variantLabel: variantLabel(l.variant),
          diet: l.variant.diet ?? l.item.diet,
          unitPricePaise: l.variant.pricePaise,
          quantity: l.line.quantity,
          lineTotalPaise: quote.lineTotalsPaise[i],
          note: l.line.note || null,
        })
        .returning();
      if (l.addons.length) {
        await tx.insert(orderItemAddons).values(l.addons.map((a) => ({ orderItemId: oi.id, addonId: a.id, name: a.name, pricePaise: a.pricePaise })));
      }
    }
    await tx.insert(payments).values({ orderId: o.id, provider: COUNTER_PROVIDER[input.payment], amountPaise: o.totalPaise, status: "captured", method: input.payment });
    await tx.insert(orderEvents).values({ orderId: o.id, fromStatus: null, toStatus: "placed", actorType: "staff", actorId: staff.id, note: `Counter sale (${input.payment})` });
    await audit(tx, { actorId: staff.id, outletId: staff.outletId, action: "pos.sale", entity: "order", entityId: o.id, data: { total: o.totalPaise, payment: input.payment } });
    return o;
  });

  await deductStockSafely(order.id);
  await notify(order, phone ? "placed" : null);
  const change = input.payment === "cash" && input.tenderedPaise !== undefined ? input.tenderedPaise - order.totalPaise : null;
  return { id: order.id, orderNumber: order.orderNumber, invoiceNumber: order.invoiceNumber, totalPaise: order.totalPaise, changePaise: change };
}