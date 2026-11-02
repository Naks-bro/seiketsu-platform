/**
 * Integration tests: real order/payment code against an in-memory Postgres
 * (PGlite), with the local payment simulator standing in for Razorpay.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "pglite:memory";
process.env.PAYMENTS_MODE = "simulator";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";

const { getConn, menuItems, menuItemVariants, addons, orders, orderEvents, payments, storeSettings, outletMenuItems, staffUsers } =
  await import("@seiketsu/db");
const { runMigrations } = await import("../../../../../packages/db/src/migrate.ts");
const { seed, openAllDay } = await import("../../../../../packages/db/src/seed.ts");
const { hmacHex } = await import("@seiketsu/core/razorpay-signature");
const { eq, and, isNull } = await import("drizzle-orm");
const orderSvc = await import("./orders");
const { handleRazorpayWebhook } = await import("./webhook");

type Db = import("@seiketsu/db").Db;
let db: Db;
let outletId: string;
let staffId: string;

async function variantOf(name: string, label: string | null = null) {
  const [row] = await db
    .select({ item: menuItems, v: menuItemVariants })
    .from(menuItemVariants)
    .innerJoin(menuItems, eq(menuItems.id, menuItemVariants.menuItemId))
    .where(and(eq(menuItems.name, name), label === null ? isNull(menuItemVariants.label) : eq(menuItemVariants.label, label)));
  if (!row) throw new Error(`No variant ${name} / ${label}`);
  return row;
}

async function addonId(name: string) {
  const [a] = await db.select().from(addons).where(eq(addons.name, name));
  return a.id;
}

const customer = { name: "Test Customer", phone: "9876543210", email: "" };

async function checkout(lines: { name: string; label?: string | null; addOns?: string[]; qty?: number }[]) {
  const resolved = await Promise.all(
    lines.map(async (l) => {
      const { item, v } = await variantOf(l.name, l.label ?? null);
      return { menuItemId: item.id, variantId: v.id, addOnIds: await Promise.all((l.addOns ?? []).map(addonId)), quantity: l.qty ?? 1 };
    }),
  );
  return orderSvc.createCheckout({ lines: resolved, customer: { ...customer }, fulfilment: "pickup", source: "web" });
}

async function orderByToken(token: string) {
  const [o] = await db.select().from(orders).where(eq(orders.publicToken, token));
  return o;
}

async function eventCount(orderId: string) {
  return (await db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId))).length;
}

function webhookBody(event: string, razorpayOrderId: string, paymentId: string, amount: number) {
  return JSON.stringify({ event, payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId, amount, method: "upi" } } } });
}

beforeAll(async () => {
  const conn = await getConn();
  await runMigrations(conn);
  db = conn.db;
  const r = await seed(db);
  outletId = r.outletId;
  await openAllDay(db, outletId);
  const [u] = await db.insert(staffUsers).values({ email: "owner@test.local", name: "Owner", passwordHash: "x" }).returning();
  staffId = u.id;
});

describe("checkout", () => {
  it("prices from the database, including variants and extras", async () => {
    const r = await checkout([
      { name: "Herbed Paneer / Chicken Protein Salad Bowl", label: "Chicken", addOns: ["Avocado", "Feta Cheese"], qty: 2 },
      { name: "Green Machine" },
    ]);
    // (350 + 80 + 80) x 2 + 240 = 1260
    expect(r.totalPaise).toBe(126000);
    expect(r.orderNumber).toMatch(/^SK-\d+$/);
    const o = await orderByToken(r.token);
    expect(o.status).toBe("pending_payment");
    expect(r.payment.razorpayOrderId).toMatch(/^order_sim_/);
  });

  it("refuses extras on items that do not offer them", async () => {
    await expect(checkout([{ name: "Green Machine", addOns: ["Avocado"] }])).rejects.toThrow(/extra is not available/);
  });

  it("refuses items hidden for owner review", async () => {
    await expect(checkout([{ name: "Large (400g) 320", label: "Large" }])).rejects.toThrow(/sold out/);
  });

  it("refuses sold-out items", async () => {
    const { item } = await variantOf("Caprese Sandwich");
    await db.update(outletMenuItems).set({ isAvailable: false }).where(eq(outletMenuItems.menuItemId, item.id));
    await expect(checkout([{ name: "Caprese Sandwich" }])).rejects.toThrow(/sold out/);
    await db.update(outletMenuItems).set({ isAvailable: true }).where(eq(outletMenuItems.menuItemId, item.id));
  });

  it("refuses orders while the store is closed", async () => {
    await db.update(storeSettings).set({ temporarilyClosed: true }).where(eq(storeSettings.outletId, outletId));
    await expect(checkout([{ name: "Green Machine" }])).rejects.toThrow(/not taking online orders/);
    await db.update(storeSettings).set({ temporarilyClosed: false }).where(eq(storeSettings.outletId, outletId));
  });
});

describe("payment confirmation", () => {
  it("places the order once, however many times confirmation arrives", async () => {
    const r = await checkout([{ name: "Sprouts Protein Salad Bowl" }]);
    const o = await orderByToken(r.token);
    const rzpOrder = r.payment.razorpayOrderId;

    await orderSvc.confirmCheckoutPayment({ token: r.token, razorpayOrderId: rzpOrder, razorpayPaymentId: "pay_sim_A" });
    expect((await orderByToken(r.token)).status).toBe("placed");
    const events = await eventCount(o.id);

    // Second verify and a webhook for the same payment change nothing.
    await orderSvc.confirmCheckoutPayment({ token: r.token, razorpayOrderId: rzpOrder, razorpayPaymentId: "pay_sim_A" });
    const body = webhookBody("payment.captured", rzpOrder, "pay_sim_A", r.totalPaise);
    const w1 = await handleRazorpayWebhook(body, hmacHex(body, "whsec_test"), "evt_1");
    expect(w1.status).toBe(200);
    const w2 = await handleRazorpayWebhook(body, hmacHex(body, "whsec_test"), "evt_1");
    expect(w2.body).toBe("duplicate");

    expect(await eventCount(o.id)).toBe(events);
    const ps = await db.select().from(payments).where(eq(payments.orderId, o.id));
    expect(ps).toHaveLength(1);
    expect(ps[0].status).toBe("captured");
  });

  it("places the order from the webhook alone if the customer closed the tab", async () => {
    const r = await checkout([{ name: "Green Machine" }]);
    const body = webhookBody("payment.captured", r.payment.razorpayOrderId, "pay_sim_B", r.totalPaise);
    const w = await handleRazorpayWebhook(body, hmacHex(body, "whsec_test"), "evt_2");
    expect(w.status).toBe(200);
    const o = await orderByToken(r.token);
    expect(o.status).toBe("placed");
    expect(o.paymentState).toBe("paid");
  });

  it("rejects webhooks with a bad signature", async () => {
    const r = await checkout([{ name: "Green Machine" }]);
    const body = webhookBody("payment.captured", r.payment.razorpayOrderId, "pay_sim_C", r.totalPaise);
    const w = await handleRazorpayWebhook(body, hmacHex(body, "wrong_secret"), "evt_3");
    expect(w.status).toBe(401);
    expect((await orderByToken(r.token)).status).toBe("pending_payment");
  });

  it("does not accept a payment for the wrong amount", async () => {
    const r = await checkout([{ name: "Green Machine" }]);
    const body = webhookBody("payment.captured", r.payment.razorpayOrderId, "pay_sim_D", 100);
    await handleRazorpayWebhook(body, hmacHex(body, "whsec_test"), "evt_4");
    expect((await orderByToken(r.token)).status).toBe("pending_payment");
    const [p] = await db.select().from(payments).where(eq(payments.razorpayOrderId, r.payment.razorpayOrderId));
    expect(p.errorCode).toBe("AMOUNT_MISMATCH");
  });

  it("records a failure, then accepts a successful retry", async () => {
    const r = await checkout([{ name: "Green Machine" }]);
    await orderSvc.markPaymentFailed({ razorpayOrderId: r.payment.razorpayOrderId, code: "BAD_REQUEST_ERROR", description: "Payment failed" });
    expect((await orderByToken(r.token)).status).toBe("payment_failed");
    await orderSvc.confirmCheckoutPayment({ token: r.token, razorpayOrderId: r.payment.razorpayOrderId, razorpayPaymentId: "pay_sim_E" });
    expect((await orderByToken(r.token)).status).toBe("placed");
  });

  it("will not confirm a payment against another order's link", async () => {
    const a = await checkout([{ name: "Green Machine" }]);
    const b = await checkout([{ name: "Green Machine" }]);
    await expect(
      orderSvc.confirmCheckoutPayment({ token: b.token, razorpayOrderId: a.payment.razorpayOrderId, razorpayPaymentId: "pay_sim_F" }),
    ).rejects.toThrow(/does not match/);
  });
});

describe("expiry", () => {
  it("expires unpaid orders, and still places them if payment lands late", async () => {
    const r = await checkout([{ name: "Green Machine" }]);
    let o = await orderByToken(r.token);
    await db.update(orders).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(orders.id, o.id));
    o = await orderSvc.reconcileOrder(await orderByToken(r.token));
    expect(o.status).toBe("expired");
    await expect(orderSvc.resumePayment(r.token)).rejects.toThrow();
    const body = webhookBody("payment.captured", r.payment.razorpayOrderId, "pay_sim_G", r.totalPaise);
    await handleRazorpayWebhook(body, hmacHex(body, "whsec_test"), "evt_5");
    expect((await orderByToken(r.token)).status).toBe("placed");
  });
});

describe("kitchen flow and refunds", () => {
  async function paidOrder() {
    const r = await checkout([{ name: "Green Machine" }]);
    await orderSvc.confirmCheckoutPayment({ token: r.token, razorpayOrderId: r.payment.razorpayOrderId, razorpayPaymentId: `pay_sim_${Math.random().toString(36).slice(2)}` });
    return orderByToken(r.token);
  }

  it("moves through the pickup steps in order and rejects skips", async () => {
    const o = await paidOrder();
    await expect(orderSvc.transitionOrder({ orderId: o.id, to: "ready", staffId, outletId })).rejects.toThrow(/Cannot move/);
    for (const to of ["accepted", "preparing", "ready", "completed"] as const) {
      await orderSvc.transitionOrder({ orderId: o.id, to, staffId, outletId });
    }
    const done = await orderByToken(o.publicToken);
    expect(done.status).toBe("completed");
    expect(done.completedAt).not.toBeNull();
  });

  it("requires a reason to reject, and refunds the payment", async () => {
    const o = await paidOrder();
    await expect(orderSvc.transitionOrder({ orderId: o.id, to: "rejected", staffId, outletId })).rejects.toThrow(/reason/);
    await orderSvc.transitionOrder({ orderId: o.id, to: "rejected", staffId, outletId, reason: "Out of celery" });
    const r = await orderSvc.refundOrder({ orderId: o.id, staffId, outletId, reason: "Out of celery" });
    expect(r.amountPaise).toBe(o.totalPaise);
    expect((await orderByToken(o.publicToken)).paymentState).toBe("refunded");
    await expect(orderSvc.refundOrder({ orderId: o.id, staffId, outletId, reason: "again" })).rejects.toThrow();
  });

  it("does not refund an order that is still being served", async () => {
    const o = await paidOrder();
    await expect(orderSvc.refundOrder({ orderId: o.id, staffId, outletId, reason: "test" })).rejects.toThrow(/Reject or cancel/);
  });
});
describe("outlet scoping", () => {
  it("staff cannot change or refund another outlet's order", async () => {
    const r = await checkout([{ name: "Green Machine" }]);
    const o = await orderByToken(r.token);
    const otherOutlet = "00000000-0000-4000-8000-000000000000";
    await expect(orderSvc.transitionOrder({ orderId: o.id, to: "accepted", staffId, outletId: otherOutlet })).rejects.toThrow(/not found/i);
    await expect(orderSvc.refundOrder({ orderId: o.id, staffId, outletId: otherOutlet, reason: "x" })).rejects.toThrow();
  });
});

describe("counter (POS)", () => {
  async function line(name: string, label: string | null = null, extras: string[] = [], quantity = 1) {
    const { item, v } = await variantOf(name, label);
    return { menuItemId: item.id, variantId: v.id, addOnIds: await Promise.all(extras.map(addonId)), quantity };
  }

  it("records a paid cash sale with a bill number and change", async () => {
    const r = await orderSvc.createPosOrder(
      { lines: [await line("Green Machine", null, [], 2)], payment: "cash", tenderedPaise: 50_000, tableLabel: "T4" },
      { id: staffId, outletId },
    );
    const [o] = await db.select().from(orders).where(eq(orders.id, r.id));
    expect(o.source).toBe("pos");
    expect(o.status).toBe("placed");
    expect(o.paymentState).toBe("paid");
    expect(o.customerName).toBe("Walk-in");
    expect(o.tableLabel).toBe("T4");
    expect(o.invoiceNumber).toMatch(/^SK\//);
    expect(r.changePaise).toBe(50_000 - o.totalPaise);
    const [p] = await db.select().from(payments).where(eq(payments.orderId, o.id));
    expect(p.provider).toBe("cash");
    expect(p.status).toBe("captured");
  });

  it("refuses too little cash and server-prices extras", async () => {
    await expect(
      orderSvc.createPosOrder({ lines: [await line("Green Machine")], payment: "cash", tenderedPaise: 1 }, { id: staffId, outletId }),
    ).rejects.toThrow(/less than the total/);
    const r = await orderSvc.createPosOrder(
      { lines: [await line("Herbed Paneer / Chicken Protein Salad Bowl", "Chicken", ["Avocado"])], payment: "upi" },
      { id: staffId, outletId },
    );
    const { v } = await variantOf("Herbed Paneer / Chicken Protein Salad Bowl", "Chicken");
    const [avo] = await db.select().from(addons).where(eq(addons.name, "Avocado"));
    const [o] = await db.select().from(orders).where(eq(orders.id, r.id));
    expect(o.subtotalPaise).toBe(v.pricePaise + avo.pricePaise);
  });

  it("refunds a counter sale by hand, without Razorpay", async () => {
    const r = await orderSvc.createPosOrder({ lines: [await line("Green Machine")], payment: "cash" }, { id: staffId, outletId });
    await orderSvc.transitionOrder({ orderId: r.id, to: "rejected", staffId, outletId, reason: "Customer left" });
    const refund = await orderSvc.refundOrder({ orderId: r.id, staffId, outletId, reason: "Customer left" });
    expect(refund.status).toBe("processed");
    const [o] = await db.select().from(orders).where(eq(orders.id, r.id));
    expect(o.paymentState).toBe("refunded");
  });
});

describe("menu editor", () => {
  it("creates, edits and archives a dish, keeping old sizes for past orders", async () => {
    const { saveMenuItem, sniffImageType } = await import("./menu-admin");
    const { categories, menuItemVariants: mv } = await import("@seiketsu/db");
    const [cat] = await db.select().from(categories).limit(1);
    const base = {
      name: "Test Bowl",
      categoryId: cat.id,
      description: "",
      diet: "veg",
      imageUrl: "",
      offersExtras: true,
      showOnMenu: true,
      variants: [
        { label: "Small", portionAmount: "300", portionUnit: "g", priceRupees: "250", kcal: "", proteinG: "", carbsG: "", fatG: "", fibreG: "", isActive: true },
        { label: "Large", portionAmount: "450", portionUnit: "g", priceRupees: "320.50", kcal: "500", proteinG: "30", carbsG: "", fatG: "", fibreG: "", isActive: true },
      ],
    };
    const id = await saveMenuItem(base, outletId);
    let vs = await db.select().from(mv).where(eq(mv.menuItemId, id));
    expect(vs.map((v) => v.pricePaise).sort()).toEqual([25_000, 32_050]);

    // Drop "Small": it is switched off, not deleted.
    const large = vs.find((v) => v.label === "Large")!;
    await saveMenuItem({ ...base, id, variants: [{ ...base.variants[1], id: large.id, priceRupees: "330" }] }, outletId);
    vs = await db.select().from(mv).where(eq(mv.menuItemId, id));
    expect(vs.find((v) => v.label === "Small")!.isActive).toBe(false);
    expect(vs.find((v) => v.label === "Large")!.pricePaise).toBe(33_000);

    await expect(saveMenuItem({ ...base, id, name: "x" }, outletId)).rejects.toThrow();
    await expect(saveMenuItem({ ...base, imageUrl: "javascript:alert(1)" }, outletId)).rejects.toThrow();

    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("image/jpeg");
    expect(sniffImageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("reports", () => {
  it("totals today's paid orders including counter sales", async () => {
    const { salesReport, parseRange } = await import("./reports");
    const r = await salesReport(outletId, parseRange({ range: "today" }));
    expect(r.totals.orders).toBeGreaterThan(0);
    expect(r.byPayment.some((p) => p.provider === "cash")).toBe(true);
    expect(r.bySource.some((s) => s.source === "pos")).toBe(true);
    expect(r.bestSellers[0].qty).toBeGreaterThan(0);
  });
});
