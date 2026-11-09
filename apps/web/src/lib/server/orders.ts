import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import {
  addonGroups,
  addons,
  customers,
  consentEvents,
  couponRedemptions,
  getDb,
  loyaltyLedger,
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
import { evaluateCoupon, loyaltySettings, pointsForPhone, redeemable, releaseRewardsIn, settleLoyaltyIn, type RewardDb } from "./rewards";
import { pointsEarned } from "@seiketsu/core/loyalty";
import { eventForStatus, type CustomerEvent } from "@seiketsu/core/messaging";
import { creditOrderRefund, nextInvoiceNumber } from "./invoices";
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
async function rewardsFor(outletId: string, subtotalPaise: number, phone: string, couponCode: string | undefined, usePoints: boolean | undefined, sessionPhone: string | null, tx: RewardDb): Promise<Rewards> {
  const r: Rewards = { couponId: null, couponCode: null, couponPaise: 0, points: 0, pointsPaise: 0 };
  if (couponCode?.trim()) {
    const c = await evaluateCoupon(outletId, couponCode, phone, subtotalPaise, tx, true);
    if ("error" in c) throw new OrderError(c.error ?? "That coupon can’t be used.", 400);
    r.couponId = c.coupon.id;
    r.couponCode = c.coupon.code;
    r.couponPaise = c.discountPaise;
  }
  if (usePoints && sessionPhone && sessionPhone === phone) {
    const mine = await pointsForPhone(phone, tx);
    if (mine) {
      const spend = redeemable(mine.balance, subtotalPaise - r.couponPaise, await loyaltySettings(outletId, tx));
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
  [v.label, v.portionAmount && v.portionUnit ? `${v.portionAmount}${v.portionUnit}` : null].filter(Boolean).join(" ") || null;

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

  const baseQuote = quoteFor(lines, store.pricing, input.fulfilment);
  if (baseQuote.belowMinimum) {
    throw new OrderError(`Minimum order is \u20b9${store.pricing.minOrderPaise / 100}.`);
  }
  const settings = await db.query.storeSettings.findFirst({ where: (s, { eq }) => eq(s.outletId, store.outletId) });
  const expiresAt = new Date(Date.now() + (settings?.paymentExpiryMinutes ?? 30) * 60_000);
  const email = input.customer.email || null;

  const order = await db.transaction(async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({ phone: input.customer.phone, name: input.customer.name, email })
      .onConflictDoUpdate({ target: customers.phone, set: opts.sessionPhone === input.customer.phone ? { name: input.customer.name, ...(email ? { email } : {}) } : { phone: input.customer.phone } })
      .returning();
    // The upsert locks this customer until commit; coupon allocation is locked in rewardsFor.
    const rewards = await rewardsFor(store.outletId, baseQuote.subtotalPaise, input.customer.phone, input.couponCode, input.usePoints, opts.sessionPhone ?? null, tx);
    const quote = quoteFor(lines, store.pricing, input.fulfilment, rewards.couponPaise + rewards.pointsPaise);
    if (quote.totalPaise <= 0) throw new OrderError("Please leave a positive amount payable after discounts.");
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
        loyaltyPointsEarned: pointsEarned(quote.subtotalPaise - quote.discountPaise, await loyaltySettings(store.outletId, tx)),
        deliveryFeePaise: quote.deliveryFeePaise,
        taxPaise: quote.taxPaise,
        totalPaise: quote.totalPaise,
        taxSnapshot: { ...store.pricing.tax, gstin: settings?.gstin ?? null },
        issuerSnapshot: { name: store.name, addressLines: store.addressLines, phone: store.phone, instagram: store.instagram },
        expiresAt,
      })
      .returning();
    if (rewards.points > 0) {
      await tx.insert(loyaltyLedger).values({ customerId: customer.id, orderId: o.id, points: -rewards.points, reason: "redeem" });
    }
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

  let payment: PaymentParams;
  try { payment = await openPayment(order); }
  catch (err) {
    // A gateway timeout may have created an order remotely; no payment can be opened without its ID.
    await db.transaction(async (tx) => {
      const [o] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
      await releaseRewardsIn(tx, o);
      await tx.update(orders).set({ status: "expired", expiresAt: new Date() }).where(eq(orders.id, o.id));
    });
    throw err;
  }
  return { token: order.publicToken, orderNumber: order.orderNumber, totalPaise: order.totalPaise, payment };
}

/** Creates (or reuses) the gateway order for an unpaid order. */
async function openPayment(order: typeof orders.$inferSelect): Promise<PaymentParams> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
    if (!current || !["pending_payment", "payment_failed"].includes(current.status)) throw new OrderError("This order is not awaiting payment.", 409);
    if (current.rewardsReleasedAt || (current.expiresAt && current.expiresAt < new Date())) throw new OrderError("This order has expired. Please place a new order.", 410);
    let [p] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, current.id), inArray(payments.status, ["created", "failed"])))
      .limit(1);
    if (!p) {
      let gw;
      try {
        gw = await gateway().createOrder({
          amountPaise: current.totalPaise,
          receipt: current.orderNumber,
          notes: { order_id: current.id, order_number: current.orderNumber },
        });
      } catch (err) {
        console.error("[checkout] gateway order failed", err);
        throw new OrderError("We could not start the payment. Please try again in a minute.", 502);
      }
      [p] = await tx
        .insert(payments)
        .values({ orderId: current.id, razorpayOrderId: gw.id, amountPaise: current.totalPaise })
        .returning();
    }
    return {
      mode: env.paymentsMode as "razorpay" | "simulator",
      keyId: env.razorpay.keyId ?? null,
      razorpayOrderId: p.razorpayOrderId!,
      amountPaise: p.amountPaise,
      prefill: { name: current.customerName, contact: `+91${current.customerPhone}`, email: current.customerEmail ?? undefined },
    };
  });
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

    const releasedDiscount = !!o.rewardsReleasedAt && o.discountPaise > 0;
    if (releasedDiscount) {
      const [u] = await tx.update(orders).set({ status: "rejected", paymentState: "paid", placedAt: new Date(), statusReason: "Payment arrived after the discount reservation expired. Refund required.", invoiceNumber: o.invoiceNumber ?? await nextInvoiceNumber(tx, new Date()) }).where(eq(orders.id, o.id)).returning();
      await tx.insert(orderEvents).values({ orderId: o.id, fromStatus: o.status, toStatus: "rejected", actorType: "system", note: u.statusReason });
      return { order: u, changed: true };
    }
    if (checkTransition({ from: o.status, to: "placed", actor: "system", fulfilment: o.fulfilment }).ok) {
      await settleLoyaltyIn(tx, o);
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
    if (result.order.status === "rejected") {
      await refundOrder({ orderId: result.order.id, staffId: null, outletId: result.order.outletId, reason: result.order.statusReason! }).catch((err) => console.error("[refund] late payment refund needs reconciliation", result.order.id, err));
      await notify(result.order, "cancelled");
    } else await notify(result.order, "placed");
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
    const expired = await db.transaction(async (tx) => {
      const [o] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
      if (!o || !["pending_payment", "payment_failed"].includes(o.status)) return null;
      await releaseRewardsIn(tx, o);
      const [u] = await tx.update(orders).set({ status: "expired" }).where(eq(orders.id, o.id)).returning();
      await tx.insert(orderEvents).values({ orderId: o.id, fromStatus: o.status, toStatus: "expired", actorType: "system" });
      return u;
    });
    if (expired) return expired;
  }
  return order;
}

export async function reconcileStale(limit = 50, deadline = Infinity) {
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
    .orderBy(sql`${orders.lastReconciledAt} asc nulls first`, asc(orders.createdAt), asc(orders.id))
    .limit(limit);
  let changed = 0;
  let checked = 0;
  for (const o of stale) {
    if (Date.now() >= deadline) break;
    await db.update(orders).set({ lastReconciledAt: new Date() }).where(eq(orders.id, o.id));
    const u = await reconcileOrder(o);
    checked++;
    if (u.status !== o.status) changed++;
  }
  return { checked, changed };
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

/** Persist an intent under the payment lock BEFORE making a provider request. */
export async function refundOrder(args: { orderId: string; staffId: string | null; outletId: string; reason: string }) {
  const db = await getDb();
  const intent = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(and(eq(payments.orderId, args.orderId), eq(payments.status, "captured"))).for("update");
    if (!p) throw new OrderError("There is no captured payment to refund.", 409);
    const [o] = await tx.select().from(orders).where(and(eq(orders.id, args.orderId), eq(orders.outletId, args.outletId))).for("update");
    if (!o) throw new OrderError("Order not found.", 404);
    if (!REFUND_ON.includes(o.status)) throw new OrderError("Reject or cancel the order before refunding.", 409);
    const [pending] = await tx.select().from(refunds).where(and(eq(refunds.paymentId, p.id), sql`${refunds.status} not in ('failed', 'processed')`));
    if (pending) throw new OrderError("A refund is already pending. Its provider result will be reconciled; do not pay it twice.", 409);
    const amount = p.amountPaise - p.refundedPaise;
    if (amount <= 0) throw new OrderError("This payment is already refunded.", 409);
    const [r] = await tx.insert(refunds).values({ paymentId: p.id, amountPaise: amount, status: "submitting", reason: args.reason, createdBy: args.staffId }).returning();
    await audit(tx, { actorId: args.staffId, outletId: o.outletId, action: "order.refund_requested", entity: "order", entityId: o.id, data: { amount, intentId: r.id } });
    return { r, p, o };
  });
  let result;
  try {
    result = intent.p.provider === "razorpay"
      ? await gateway().refund(intent.p.razorpayPaymentId!, intent.r.amountPaise, { order_number: intent.o.orderNumber, reason: args.reason.slice(0, 200), refund_intent: intent.r.id })
      : { id: `manual_${intent.r.id}`, status: "processed" };
  } catch (err) {
    // Only an explicit provider rejection proves that no refund request was accepted.
    const code = Number((err as { statusCode?: unknown })?.statusCode);
    const declined = [400, 401, 403, 404, 422].includes(code);
    await db.update(refunds).set({ status: declined ? "failed" : "unknown" }).where(and(eq(refunds.id, intent.r.id), eq(refunds.status, "submitting")));
    console.error("[refund] provider request failed", intent.r.id, err);
    if (declined) throw new OrderError("The payment provider declined this refund request. Check the payment and provider settings before retrying.", 502);
    throw new OrderError("Refund confirmation is pending. It will be checked with the payment provider; do not issue a second refund.", 502);
  }
  await updateRefundStatus(result.id, result.status, intent.r.id);
  return { refundId: result.id, amountPaise: intent.r.amountPaise, status: result.status };
}

/** Provider responses and webhooks share the same locked, monotonic financial update. */
export async function updateRefundStatus(razorpayRefundId: string, status: string, intentId?: string) {
  if (!["processed", "failed", "pending", "created"].includes(status)) status = "pending";
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const [found] = await tx.select().from(refunds).where(intentId ? eq(refunds.id, intentId) : eq(refunds.razorpayRefundId, razorpayRefundId));
    if (!found) throw new OrderError("Unknown refund; retry webhook after the refund request completes.", 409);
    const [p] = await tx.select().from(payments).where(eq(payments.id, found.paymentId)).for("update");
    const [o] = await tx.select().from(orders).where(eq(orders.id, p.orderId)).for("update");
    const [r] = await tx.select().from(refunds).where(eq(refunds.id, found.id)).for("update");
    if (r.razorpayRefundId && r.razorpayRefundId !== razorpayRefundId) throw new OrderError("Refund provider ID mismatch.", 409);
    // Processed is terminal. A delayed pending event must not regress a failed attempt either.
    if (r.status === "processed" || (r.status === "failed" && status !== "processed")) return null;
    await tx.update(refunds).set({ razorpayRefundId, status }).where(eq(refunds.id, r.id));
    if (status !== "processed") return null;
    if (o.customerId) await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, o.customerId)).for("update");
    const [sum] = await tx.select({ amount: sql<number>`coalesce(sum(${refunds.amountPaise}), 0)::int` }).from(refunds).where(and(eq(refunds.paymentId, p.id), eq(refunds.status, "processed")));
    const full = sum.amount >= p.amountPaise;
    await tx.update(payments).set({ refundedPaise: sum.amount, status: full ? "refunded" : "captured" }).where(eq(payments.id, p.id));
    await tx.update(orders).set({ paymentState: full ? "refunded" : "partially_refunded" }).where(eq(orders.id, o.id));
    if (full) await releaseRewardsIn(tx, o);
    await creditOrderRefund(tx, o, { ref: razorpayRefundId, amountPaise: r.amountPaise, at: new Date() });
    await audit(tx, { actorId: r.createdBy, outletId: o.outletId, action: "order.refund_processed", entity: "order", entityId: o.id, data: { amount: r.amountPaise, refundId: razorpayRefundId } });
    return { o, amount: r.amountPaise };
  });
  if (result) await notify(result.o, "refunded", { amountPaise: result.amount });
}

/** Resolve ambiguous/pending refunds by provider ID or the durable intent in provider notes. */
export async function reconcileRefunds(limit = 25, deadline = Infinity) {
  const db = await getDb();
  const rows = await db.select({ r: refunds, p: payments }).from(refunds).innerJoin(payments, eq(payments.id, refunds.paymentId))
    .where(and(eq(payments.provider, "razorpay"), sql`${refunds.status} not in ('processed', 'failed')`))
    .orderBy(asc(refunds.updatedAt), asc(refunds.id)).limit(limit);
  let checked = 0;
  for (const { r, p } of rows) {
    if (Date.now() >= deadline) break;
    // Advance even on a provider failure so one bad intent cannot starve the queue.
    await db.update(refunds).set({ updatedAt: new Date() }).where(eq(refunds.id, r.id));
    try {
      const remote = await gateway().paymentRefunds(p.razorpayPaymentId!);
      const match = remote.find((x) => x.id === r.razorpayRefundId || x.intentId === r.id);
      if (match && match.amountPaise === r.amountPaise) await updateRefundStatus(match.id, match.status, r.id);
      checked++;
    } catch (err) { console.error("[refund] reconcile failed", r.id, err); }
  }
  // Released-discount captures are deliberately rejected and must be refunded, including after a crash.
  const late = await db.select().from(orders).where(and(eq(orders.status, "rejected"), eq(orders.paymentState, "paid"), sql`${orders.rewardsReleasedAt} is not null`, gt(orders.discountPaise, 0), sql`not exists (select 1 from ${refunds} r join ${payments} p on p.id = r.payment_id where p.order_id = ${orders.id})`)).orderBy(asc(orders.placedAt)).limit(limit);
  for (const o of late) {
    if (Date.now() >= deadline) break;
    const attempts = await db.select({ id: refunds.id }).from(refunds).innerJoin(payments, eq(payments.id, refunds.paymentId)).where(eq(payments.orderId, o.id));
    if (!attempts.length) await refundOrder({ orderId: o.id, staffId: null, outletId: o.outletId, reason: o.statusReason ?? "Late payment after discount expiry" }).catch((err) => console.error("[refund] late payment", o.id, err));
  }
  return checked;
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
  const store = await getStore(staff.outletId);
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
        issuerSnapshot: { name: store.name, addressLines: store.addressLines, phone: store.phone, instagram: store.instagram },
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
    await settleLoyaltyIn(tx, o);
    return o;
  });

  await deductStockSafely(order.id);
  await notify(order, phone ? "placed" : null);
  const change = input.payment === "cash" && input.tenderedPaise !== undefined ? input.tenderedPaise - order.totalPaise : null;
  return { id: order.id, orderNumber: order.orderNumber, invoiceNumber: order.invoiceNumber, totalPaise: order.totalPaise, changePaise: change };
}
