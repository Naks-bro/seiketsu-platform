/**
 * Subscription payments against an in-memory Postgres (PGlite), with the local
 * payment simulator standing in for Razorpay: pay, renew, refund, offline, tax.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "pglite:memory";
process.env.PAYMENTS_MODE = "simulator";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";

const { getConn, invoices, storeSettings, subscriptionPayments, subscriptionPlans, subscriptions } = await import("@seiketsu/db");
const { runMigrations } = await import("../../../../../packages/db/src/migrate.ts");
const { seed } = await import("../../../../../packages/db/src/seed.ts");
const { hmacHex } = await import("@seiketsu/core/razorpay-signature");
const { addDays, istToday } = await import("@seiketsu/core/subscriptions");
const { eq } = await import("drizzle-orm");
const svc = await import("./subscription-payments");
const { createSubscription } = await import("./subscriptions");
const { handleRazorpayWebhook } = await import("./webhook");

type Db = import("@seiketsu/db").Db;
let db: Db;
let outletId: string;
let plan: typeof subscriptionPlans.$inferSelect;

beforeAll(async () => {
  const conn = await getConn();
  await runMigrations(conn);
  db = conn.db;
  outletId = (await seed(db)).outletId;
  [plan] = await db
    .insert(subscriptionPlans)
    .values({ outletId, slug: "lunch-20", name: "Lunch 20", mealsTotal: 20, durationDays: 28, pricePaise: 450000, isActive: true })
    .returning();
});

async function newSub(startDate = addDays(istToday(), 2)) {
  return createSubscription({ outletId, plan, name: "Asha Rao", phone: "9876543210", email: null, address: "Flat 4, Sea View, JP Road", pincode: "400061", startDate, notes: null });
}

async function pay(token: string, paymentId = `pay_sim_${crypto.randomUUID().slice(0, 8)}`) {
  const params = await svc.startSubscriptionPayment(token);
  const status = await svc.confirmSubscriptionPayment({ token, razorpayOrderId: params.razorpayOrderId, razorpayPaymentId: paymentId });
  return { params, status, paymentId };
}

const subRow = async (id: string) => (await db.select().from(subscriptions).where(eq(subscriptions.id, id)))[0];
const invoicesOf = (id: string) => db.select().from(invoices).where(eq(invoices.subscriptionId, id));

function signed(body: string) {
  return hmacHex(body, "whsec_test");
}

describe("subscription payments", () => {
  it("confirms and activates the plan on the first online payment, with an invoice", async () => {
    const sub = await newSub();
    const { params, status } = await pay(sub.publicToken);
    expect(params.kind).toBe("first");
    expect(params.amountPaise).toBe(450000);
    expect(status).toBe("paid");
    const after = await subRow(sub.id);
    expect(after.status).toBe("active");
    expect(after.paidAt).not.toBeNull();
    expect(after.startDate).toBe(sub.startDate);
    const bills = await invoicesOf(sub.id);
    expect(bills).toHaveLength(1);
    expect(bills[0]).toMatchObject({ kind: "subscription", totalPaise: 450000, taxPaise: 0, customerName: "Asha Rao" });
    expect(bills[0].number).toMatch(/^SK\/\d{4}-\d{2}\/\d{5}$/);
  });

  it("applies a payment once, however many times it is reported", async () => {
    const sub = await newSub();
    const { params, paymentId } = await pay(sub.publicToken);
    await svc.confirmSubscriptionPayment({ token: sub.publicToken, razorpayOrderId: params.razorpayOrderId, razorpayPaymentId: paymentId });
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: paymentId, order_id: params.razorpayOrderId, amount: 450000, method: "upi" } } } });
    const r = await handleRazorpayWebhook(body, signed(body), `evt_${paymentId}`);
    expect(r.status).toBe(200);
    expect(await invoicesOf(sub.id)).toHaveLength(1);
  });

  it("is paid from the webhook alone if the customer closed the tab", async () => {
    const sub = await newSub();
    const params = await svc.startSubscriptionPayment(sub.publicToken);
    const body = JSON.stringify({ event: "order.paid", payload: { payment: { entity: { id: "pay_sim_hook1", order_id: params.razorpayOrderId, amount: 450000, method: "card" } } } });
    expect((await handleRazorpayWebhook(body, signed(body), "evt_hook1")).status).toBe(200);
    expect((await subRow(sub.id)).status).toBe("active");
  });

  it("reuses an open attempt instead of opening a second Razorpay order", async () => {
    const sub = await newSub();
    const a = await svc.startSubscriptionPayment(sub.publicToken);
    const b = await svc.startSubscriptionPayment(sub.publicToken);
    expect(b.razorpayOrderId).toBe(a.razorpayOrderId);
  });

  it("refuses a payment for the wrong amount", async () => {
    const sub = await newSub();
    const params = await svc.startSubscriptionPayment(sub.publicToken);
    await svc.markSubscriptionCaptured({ razorpayOrderId: params.razorpayOrderId, razorpayPaymentId: "pay_sim_short", amountPaise: 100, method: "upi", via: "webhook" });
    expect((await subRow(sub.id)).paidAt).toBeNull();
    expect(await invoicesOf(sub.id)).toHaveLength(0);
  });

  it("renews from the end date, adding the plan's meals, with a second invoice", async () => {
    const sub = await newSub(istToday());
    await pay(sub.publicToken);
    const before = await subRow(sub.id);
    const { params } = await pay(sub.publicToken);
    expect(params.kind).toBe("renewal");
    const after = await subRow(sub.id);
    expect(after.mealsTotal).toBe(40);
    expect(after.endDate).toBe(addDays(before.endDate!, 28));
    expect(await invoicesOf(sub.id)).toHaveLength(2);
  });

  it("will not take money for a cancelled plan", async () => {
    const sub = await newSub();
    await db.update(subscriptions).set({ status: "cancelled" }).where(eq(subscriptions.id, sub.id));
    await expect(svc.startSubscriptionPayment(sub.publicToken)).rejects.toThrow(/nothing to pay/);
  });

  it("issues one credit note for a refund made in the Razorpay dashboard", async () => {
    const sub = await newSub();
    const { paymentId } = await pay(sub.publicToken);
    const body = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_sub_1", payment_id: paymentId, amount: 150000, status: "processed" } } } });
    expect((await handleRazorpayWebhook(body, signed(body), "evt_rf1")).status).toBe(200);
    expect((await handleRazorpayWebhook(body, signed(body), "evt_rf1_again")).status).toBe(200);
    const notes = (await invoicesOf(sub.id)).filter((i) => i.kind === "credit_note");
    expect(notes).toHaveLength(1);
    expect(notes[0].totalPaise).toBe(150000);
    expect(notes[0].number).toMatch(/^CN\//);
    const [p] = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.razorpayPaymentId, paymentId));
    expect(p.refundedPaise).toBe(150000);
  });

  it("records cash taken by staff with an invoice, leaving activation to staff", async () => {
    const sub = await newSub();
    await svc.recordOfflinePayment(outletId, sub.id, { note: "Cash at counter", staffId: null });
    const after = await subRow(sub.id);
    expect(after.paidAt).not.toBeNull();
    expect(after.status).toBe("pending");
    const [bill] = await invoicesOf(sub.id);
    expect(bill.paymentMethod).toBe("Cash at counter");
  });

  it("splits tax out of the invoice only when the owner has switched it on", async () => {
    await db.update(storeSettings).set({ taxEnabled: true, taxRateBps: 500, taxInclusive: true, gstin: "27ABCDE1234F1Z5" }).where(eq(storeSettings.outletId, outletId));
    try {
      const sub = await newSub();
      const { params } = await pay(sub.publicToken);
      expect(params.amountPaise).toBe(450000);
      const [bill] = await invoicesOf(sub.id);
      expect(bill.taxPaise + bill.taxablePaise).toBe(450000);
      expect(bill.taxPaise).toBe(450000 - Math.round((450000 * 10000) / 10500));
      expect(bill.taxSnapshot.gstin).toBe("27ABCDE1234F1Z5");
    } finally {
      await db.update(storeSettings).set({ taxEnabled: false, gstin: null }).where(eq(storeSettings.outletId, outletId));
    }
  });
});
