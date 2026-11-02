/**
 * Integration tests for customer login, consent, messaging and bills, against
 * an in-memory Postgres with messaging in dev "log" mode.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "pglite:memory";
process.env.PAYMENTS_MODE = "simulator";

// Customer sessions use next/headers cookies(); give tests a simple in-memory jar.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
  headers: async () => new Headers(),
}));

const { getConn, menuItems, menuItemVariants, payments, messageLog, customers, consentEvents, storeSettings } = await import("@seiketsu/db");
const { runMigrations } = await import("../../../../../packages/db/src/migrate.ts");
const { seed, openAllDay } = await import("../../../../../packages/db/src/seed.ts");
const { eq, and, isNull } = await import("drizzle-orm");
const { DEFAULT_MESSAGING } = await import("@seiketsu/core/messaging");
const orderSvc = await import("./orders");
const auth = await import("./customer-auth");
const { sendMessage, applyDeliveryReport } = await import("./messaging/send");

type Db = import("@seiketsu/db").Db;
let db: Db;
let outletId: string;

const waitFor = async <T>(fn: () => Promise<T | undefined | null | false>, ms = 3000): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 25));
  }
};

async function paidOrder(phone: string, marketing?: { whatsapp: boolean; email: boolean }, email = "") {
  const [row] = await db
    .select({ item: menuItems, v: menuItemVariants })
    .from(menuItemVariants)
    .innerJoin(menuItems, eq(menuItems.id, menuItemVariants.menuItemId))
    .where(and(eq(menuItems.name, "Green Machine"), isNull(menuItemVariants.label)));
  const r = await orderSvc.createCheckout({
    lines: [{ menuItemId: row.item.id, variantId: row.v.id, addOnIds: [], quantity: 1 }],
    customer: { name: "Asha Rao", phone, email },
    fulfilment: "pickup",
    source: "web",
    marketing,
  });
  const o = await orderSvc.markPaymentCaptured({
    razorpayOrderId: r.payment.razorpayOrderId,
    razorpayPaymentId: `pay_${phone}_${Math.random().toString(36).slice(2, 8)}`,
    amountPaise: r.totalPaise,
    method: "upi",
    feePaise: 1000,
    feeTaxPaise: 180,
    via: "webhook",
  });
  return o;
}

beforeAll(async () => {
  const conn = await getConn();
  await runMigrations(conn);
  db = conn.db;
  outletId = (await seed(db)).outletId;
  await openAllDay(db, outletId);
});

describe("paid orders", () => {
  it("get sequential bill numbers, store Razorpay fees and send one confirmation", async () => {
    const a = await paidOrder("9000000001");
    const b = await paidOrder("9000000002");
    expect(a.invoiceNumber).toMatch(/^SK\/\d{4}-\d{2}\/\d{5}$/);
    expect(Number(b.invoiceNumber!.slice(-5))).toBe(Number(a.invoiceNumber!.slice(-5)) + 1);

    const [p] = await db.select().from(payments).where(eq(payments.orderId, a.id));
    expect(p.feePaise).toBe(1000);
    expect(p.feeTaxPaise).toBe(180);

    const msg = await waitFor(async () => (await db.select().from(messageLog).where(eq(messageLog.orderId, a.id)))[0]);
    expect(msg.kind).toBe("order_placed");
    expect(msg.channel).toBe("whatsapp");
    expect(msg.status).toBe("sent");
    expect(msg.costMilliPaise).toBe(DEFAULT_MESSAGING.rates.whatsappUtility);
    expect(msg.vars?.link).toContain(`/order/${a.publicToken}`);

    // A repeat capture (verify after webhook) changes nothing and sends nothing more.
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, a.id));
    await orderSvc.markPaymentCaptured({ razorpayOrderId: pay.razorpayOrderId!, razorpayPaymentId: pay.razorpayPaymentId!, amountPaise: pay.amountPaise, method: "upi", via: "verify" });
    await new Promise((r) => setTimeout(r, 100));
    expect((await db.select().from(messageLog).where(eq(messageLog.orderId, a.id))).length).toBe(1);
  });

  it("records marketing opt-ins from checkout, and never removes them", async () => {
    await paidOrder("9000000003", { whatsapp: true, email: true }, "asha@example.com");
    const [c] = await db.select().from(customers).where(eq(customers.phone, "9000000003"));
    expect(c.marketingWhatsapp).toBe(true);
    expect(c.marketingEmail).toBe(true);
    expect((await db.select().from(consentEvents).where(eq(consentEvents.customerId, c.id))).length).toBe(2);

    await paidOrder("9000000003", { whatsapp: false, email: false });
    const [again] = await db.select().from(customers).where(eq(customers.phone, "9000000003"));
    expect(again.marketingWhatsapp).toBe(true);
  });

  it("notifies on ready for pickup but not on accept", async () => {
    const o = await paidOrder("9000000004");
    const [staff] = await db.select({ id: customers.id }).from(customers).limit(1); // any uuid works as actor
    await orderSvc.transitionOrder({ orderId: o.id, to: "accepted", staffId: staff.id });
    await orderSvc.transitionOrder({ orderId: o.id, to: "preparing", staffId: staff.id });
    await orderSvc.transitionOrder({ orderId: o.id, to: "ready", staffId: staff.id });
    const kinds = await waitFor(async () => {
      const rows = await db.select().from(messageLog).where(eq(messageLog.orderId, o.id));
      return rows.length >= 2 ? rows.map((r) => r.kind).sort() : null;
    });
    expect(kinds).toEqual(["order_placed", "order_ready"]);
  });
});

describe("messaging", () => {
  it("falls back to SMS once when WhatsApp reports failure", async () => {
    const sent = await sendMessage({ kind: "order_ready", to: "9000000005", vars: { name: "Asha", order: "SK-1" }, outletId });
    const [row] = await db.select().from(messageLog).where(eq(messageLog.id, sent.id));
    await applyDeliveryReport(row.providerMessageId!, "FAILED", "not on WhatsApp");
    await applyDeliveryReport(row.providerMessageId!, "FAILED", "repeat report");
    const fallbacks = await db.select().from(messageLog).where(eq(messageLog.fallbackOf, row.id));
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0].channel).toBe("sms");
    const [failed] = await db.select().from(messageLog).where(eq(messageLog.id, row.id));
    expect(failed.status).toBe("failed");
  });

  it("skips order updates once the daily budget is used up", async () => {
    await db.update(storeSettings).set({ messaging: { ...DEFAULT_MESSAGING, dailyBudgetPaise: 1 } }).where(eq(storeSettings.outletId, outletId));
    const r = await sendMessage({ kind: "order_ready", to: "9000000006", vars: { name: "A", order: "SK-2" }, outletId });
    expect(r.status).toBe("skipped");
    expect(r.error).toMatch(/budget/);
    // Owner alerts still go out.
    const alert = await sendMessage({ kind: "staff_alert", to: "9000000007", vars: { message: "x" }, outletId, ignoreBudget: true });
    expect(alert.status).toBe("sent");
    await db.update(storeSettings).set({ messaging: DEFAULT_MESSAGING }).where(eq(storeSettings.outletId, outletId));
  });
});

describe("phone login", () => {
  async function requestCode(phone: string, ip = "1.1.1.1") {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const r = await auth.requestOtp({ phone, ip });
    const line = spy.mock.calls.map((c) => String(c[0])).find((l) => l.includes("[message:") && l.includes(" otp "));
    spy.mockRestore();
    const code = line?.match(/(\d{6}) is your Seiketsu login code/)?.[1];
    if (!code) throw new Error("code not logged");
    return { ...r, code };
  }

  it("signs in with the right code once, never stores the code", async () => {
    const { challengeId, code } = await requestCode("9111111111");
    const [log] = await db.select().from(messageLog).where(and(eq(messageLog.kind, "otp"), eq(messageLog.recipient, "9111111111")));
    expect(log.vars).toBeNull();

    const wrong = code === "000000" ? "111111" : "000000";
    await expect(auth.verifyOtp({ challengeId, code: wrong, ip: "1.1.1.1" })).rejects.toThrow(/not right/);
    const c = await auth.verifyOtp({ challengeId, code, ip: "1.1.1.1" });
    expect(c.phone).toBe("9111111111");
    expect((await auth.getCustomer())?.id).toBe(c.id);
    await expect(auth.verifyOtp({ challengeId, code, ip: "1.1.1.1" })).rejects.toThrow(/expired|already/);
  });

  it("locks a code after 5 wrong tries", async () => {
    const { challengeId, code } = await requestCode("9222222222", "2.2.2.2");
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(auth.verifyOtp({ challengeId, code: wrong, ip: "2.2.2.2" })).rejects.toThrow(/not right/);
    await expect(auth.verifyOtp({ challengeId, code, ip: "2.2.2.2" })).rejects.toThrow(/Too many/);
  });

  it("limits code requests per phone", async () => {
    for (let i = 0; i < 3; i++) await requestCode("9333333333", `3.3.3.${i}`);
    await expect(auth.requestOtp({ phone: "9333333333", ip: "3.3.3.9" })).rejects.toThrow(/Too many/);
  });

  it("records consent changes", async () => {
    const [c] = await db.select().from(customers).where(eq(customers.phone, "9111111111"));
    await auth.setConsent(c.id, "whatsapp", true, "account", null);
    await auth.setConsent(c.id, "whatsapp", true, "account", null); // no-op
    await auth.setConsent(c.id, "whatsapp", false, "stop_keyword", null);
    const events = await db.select().from(consentEvents).where(eq(consentEvents.customerId, c.id));
    expect(events.map((e) => e.granted)).toEqual([true, false]);
  });
});