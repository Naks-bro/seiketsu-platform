/** Subscribing: validation, delivery area, the plan snapshot, then tracking meals through to the end. */
import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "pglite:memory";
vi.mock("@/lib/server/request", () => ({ clientIp: async () => "203.0.113.21" }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

const { getConn, subscriptionPlans, subscriptions, storeSettings, outlets } = await import("@seiketsu/db");
const { runMigrations } = await import("../../../../../../../packages/db/src/migrate.ts");
const { seed } = await import("../../../../../../../packages/db/src/seed.ts");
const { addDays, istToday } = await import("@seiketsu/core/subscriptions");
const { subscribeAction } = await import("./actions");
const { dueOn, moveSubscription, recordDelivery, undoDelivery } = await import("@/lib/server/subscriptions");
const { eq } = await import("drizzle-orm");

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const tomorrow = addDays(istToday(), 1);
const good = { slug: "test-plan", name: "Asha", phone: "+91 98765 43210", email: "", address: "Flat 4, Sea View, JP Road", pincode: "400061", startDate: tomorrow, notes: "" };
let outletId = "";

beforeAll(async () => {
  const conn = await getConn();
  await runMigrations(conn);
  await seed(conn.db);
  const [o] = await conn.db.select().from(outlets);
  outletId = o.id;
  await conn.db.update(storeSettings).set({ deliveryPincodes: ["400061"] });
  // Two meals, every day: small enough to run to the end in a test.
  await conn.db.insert(subscriptionPlans).values({ outletId, slug: "test-plan", name: "Test Plan", mealsTotal: 2, durationDays: 5, pricePaise: 100000, isActive: true });
});

async function subscribe(fields: Record<string, string>) {
  try {
    return await subscribeAction(undefined, form(fields));
  } catch (e) {
    return { redirected: (e as { url?: string }).url };
  }
}

describe("subscribing", () => {
  it("checks the fields, the start date and the delivery area", async () => {
    const r = (await subscribe({ ...good, phone: "123" })) as { fields?: Record<string, string> };
    expect(Object.keys(r.fields ?? {})).toEqual(["phone"]);
    const r2 = (await subscribe({ ...good, startDate: istToday() })) as { fields?: Record<string, string> };
    expect(r2.fields?.startDate).toMatch(/tomorrow/);
    const r3 = (await subscribe({ ...good, pincode: "400001" })) as { fields?: Record<string, string> };
    expect(r3.fields?.pincode).toMatch(/don't deliver/);
  });

  it("creates a request with the plan copied in, then tracks meals to the end", async () => {
    const r = (await subscribe(good)) as { redirected?: string };
    expect(r.redirected).toMatch(/^\/subscription\/.+\?new=1$/);
    const db = (await getConn()).db;
    const [sub] = await db.select().from(subscriptions);
    expect(sub).toMatchObject({ status: "pending", planName: "Test Plan", mealsTotal: 2, pricePaise: 100000, phone: "9876543210", startDate: tomorrow, endDate: addDays(tomorrow, 4) });

    await moveSubscription(outletId, sub.id, "active", istToday());
    expect((await dueOn(outletId, tomorrow)).map((d) => d.sub.id)).toEqual([sub.id]);
    await recordDelivery(outletId, sub.id, tomorrow, "delivered", null);
    await expect(recordDelivery(outletId, sub.id, tomorrow, "delivered", null)).rejects.toThrow(/already/);
    await recordDelivery(outletId, sub.id, addDays(tomorrow, 1), "delivered", null);
    let [after] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
    expect(after).toMatchObject({ mealsUsed: 2, status: "completed" });
    // The finished plan still shows on the day of its last meal, so the tap can be undone.
    expect((await dueOn(outletId, addDays(tomorrow, 1))).map((d) => d.recorded?.status)).toEqual(["delivered"]);

    await undoDelivery(outletId, sub.id, addDays(tomorrow, 1));
    [after] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
    expect(after).toMatchObject({ mealsUsed: 1, status: "active" });
  });

  it("moves the end date on by the days a plan was paused", async () => {
    const db = (await getConn()).db;
    const [sub] = await db.select().from(subscriptions);
    await moveSubscription(outletId, sub.id, "paused", tomorrow);
    const resumed = await moveSubscription(outletId, sub.id, "active", addDays(tomorrow, 3));
    expect(resumed.endDate).toBe(addDays(tomorrow, 7));
    await expect(moveSubscription(outletId, sub.id, "pending")).rejects.toThrow(/cannot/);
  });
});
