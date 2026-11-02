/**
 * Inventory against a real (in-memory) Postgres: deliveries, wastage, counts,
 * recipes, and stock coming out automatically when orders are paid.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "pglite:memory";
process.env.PAYMENTS_MODE = "simulator";

const { getConn, menuItems, menuItemVariants, addons, ingredients, orders, outlets, stockMovements, staffUsers } = await import("@seiketsu/db");
const { runMigrations } = await import("../../../../../packages/db/src/migrate.ts");
const { seed, openAllDay } = await import("../../../../../packages/db/src/seed.ts");
const { eq, and, isNull } = await import("drizzle-orm");
const inv = await import("./inventory");
const orderSvc = await import("./orders");

type Db = import("@seiketsu/db").Db;
let db: Db;
let outletId: string;
let staff: { id: string; outletId: string };

async function variantOf(name: string, label: string | null = null) {
  const [row] = await db
    .select({ item: menuItems, v: menuItemVariants })
    .from(menuItemVariants)
    .innerJoin(menuItems, eq(menuItems.id, menuItemVariants.menuItemId))
    .where(and(eq(menuItems.name, name), label === null ? isNull(menuItemVariants.label) : eq(menuItemVariants.label, label)));
  if (!row) throw new Error(`No variant ${name} / ${label}`);
  return row;
}

async function line(name: string, label: string | null = null, extras: string[] = [], quantity = 1) {
  const { item, v } = await variantOf(name, label);
  const addOnIds = await Promise.all(extras.map(async (n) => (await db.select().from(addons).where(eq(addons.name, n)))[0].id));
  return { menuItemId: item.id, variantId: v.id, addOnIds, quantity };
}

async function stockOf(id: string) {
  const [i] = await db.select().from(ingredients).where(eq(ingredients.id, id));
  return i;
}

let chicken: string;
let lettuce: string;
let avocado: string;

beforeAll(async () => {
  const conn = await getConn();
  await runMigrations(conn);
  db = conn.db;
  outletId = (await seed(db)).outletId;
  await openAllDay(db, outletId);
  const [u] = await db.insert(staffUsers).values({ email: "inv@test.local", name: "Inv", passwordHash: "x" }).returning();
  staff = { id: u.id, outletId };
  // Test quantities only; real recipes come from the owner.
  chicken = await inv.saveIngredient({ name: "Test chicken", unit: "g", reorder: "1", reorderUnit: "kg" }, staff);
  lettuce = await inv.saveIngredient({ name: "Test lettuce", unit: "g" }, staff);
  avocado = await inv.saveIngredient({ name: "Test avocado", unit: "pc" }, staff);
});

describe("recording stock", () => {
  it("adds deliveries and keeps a moving-average cost", async () => {
    await inv.recordMovement({ ingredientId: chicken, kind: "purchase", qty: "2", qtyUnit: "kg", total: "800" }, staff);
    let c = await stockOf(chicken);
    expect(c.stockMilli).toBe(2_000_000);
    expect(c.costMilliPaise).toBe(40_000); // ₹400/kg
    await inv.recordMovement({ ingredientId: chicken, kind: "purchase", qty: "2000", qtyUnit: "g", total: "1000" }, staff);
    c = await stockOf(chicken);
    expect(c.stockMilli).toBe(4_000_000);
    expect(c.costMilliPaise).toBe(45_000); // ₹450/kg average
  });

  it("takes out wastage and sets stock from a shelf count", async () => {
    await inv.recordMovement({ ingredientId: lettuce, kind: "count", qty: "3", qtyUnit: "kg" }, staff);
    await inv.recordMovement({ ingredientId: lettuce, kind: "wastage", qty: "250", qtyUnit: "g", note: "wilted" }, staff);
    expect((await stockOf(lettuce)).stockMilli).toBe(2_750_000);
    await inv.recordMovement({ ingredientId: lettuce, kind: "count", qty: "2.5", qtyUnit: "kg" }, staff);
    expect((await stockOf(lettuce)).stockMilli).toBe(2_500_000);
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.ingredientId, lettuce));
    expect(moves.map((m) => m.deltaMilli)).toEqual([3_000_000, -250_000, -250_000]);
    expect(moves.at(-1)!.stockAfterMilli).toBe(2_500_000);
  });

  it("refuses wrong units, zero deliveries and other outlets' ingredients", async () => {
    await expect(inv.recordMovement({ ingredientId: avocado, kind: "purchase", qty: "1", qtyUnit: "kg" }, staff)).rejects.toThrow(/not a unit/);
    await expect(inv.recordMovement({ ingredientId: chicken, kind: "purchase", qty: "0", qtyUnit: "kg" }, staff)).rejects.toThrow(/how much/);
    const [other] = await db.insert(outlets).values({ slug: "inv-other", name: "Other", addressLines: ["x"] }).returning();
    await expect(inv.recordMovement({ ingredientId: chicken, kind: "wastage", qty: "1", qtyUnit: "g" }, { id: staff.id, outletId: other.id })).rejects.toThrow(/not found/i);
  });

  it("will not reuse a name or change a unit once it is in use", async () => {
    await expect(inv.saveIngredient({ name: "Test chicken", unit: "g" }, staff)).rejects.toThrow(/already/);
    await expect(inv.saveIngredient({ id: chicken, name: "Test chicken", unit: "pc" }, staff)).rejects.toThrow(/unit can't change/);
  });
});

describe("recipes and sales", () => {
  it("takes a counter sale's ingredients out of stock, once", async () => {
    const { v } = await variantOf("Herbed Paneer / Chicken Protein Salad Bowl", "Chicken");
    const [avo] = await db.select().from(addons).where(eq(addons.name, "Avocado"));
    await inv.saveRecipe({ variantId: v.id, lines: [{ ingredientId: chicken, qty: "150", qtyUnit: "g" }, { ingredientId: lettuce, qty: "80", qtyUnit: "g" }] }, staff);
    await inv.saveRecipe({ addonId: avo.id, lines: [{ ingredientId: avocado, qty: "0.5", qtyUnit: "pcs" }] }, staff);

    const before = { c: (await stockOf(chicken)).stockMilli, l: (await stockOf(lettuce)).stockMilli, a: (await stockOf(avocado)).stockMilli };
    const sale = await orderSvc.createPosOrder({ lines: [await line("Herbed Paneer / Chicken Protein Salad Bowl", "Chicken", ["Avocado"], 2)], payment: "cash" }, staff);
    expect((await stockOf(chicken)).stockMilli).toBe(before.c - 300_000);
    expect((await stockOf(lettuce)).stockMilli).toBe(before.l - 160_000);
    expect((await stockOf(avocado)).stockMilli).toBe(before.a - 1_000); // stock can go negative

    // Repeats (cron sweep, retries) change nothing.
    expect(await inv.deductStockForOrder(sale.id)).toBe(0);
    expect(await inv.sweepStockDeductions()).toBeGreaterThanOrEqual(0);
    expect((await stockOf(chicken)).stockMilli).toBe(before.c - 300_000);
    const [o] = await db.select().from(orders).where(eq(orders.id, sale.id));
    expect(o.stockDeductedAt).not.toBeNull();
  });

  it("deducts on online payment and puts stock back when the order is rejected", async () => {
    const { item, v } = await variantOf("Herbed Paneer / Chicken Protein Salad Bowl", "Chicken");
    const start = (await stockOf(chicken)).stockMilli;
    const r = await orderSvc.createCheckout({
      lines: [{ menuItemId: item.id, variantId: v.id, addOnIds: [], quantity: 1 }],
      customer: { name: "Stock Test", phone: "9876500000", email: "" },
      fulfilment: "pickup",
      source: "web",
    });
    expect((await stockOf(chicken)).stockMilli).toBe(start); // not paid yet
    await orderSvc.confirmCheckoutPayment({ token: r.token, razorpayOrderId: r.payment.razorpayOrderId, razorpayPaymentId: "pay_sim_inv1" });
    expect((await stockOf(chicken)).stockMilli).toBe(start - 150_000);

    const [o] = await db.select().from(orders).where(eq(orders.publicToken, r.token));
    await orderSvc.transitionOrder({ orderId: o.id, to: "rejected", staffId: staff.id, outletId, reason: "Out of chicken" });
    expect((await stockOf(chicken)).stockMilli).toBe(start);
    const kinds = (await db.select().from(stockMovements).where(eq(stockMovements.orderId, o.id))).map((m) => m.kind).sort();
    expect(kinds).toEqual(["return", "return", "sale", "sale"]);
  });

  it("validates recipes", async () => {
    const { v } = await variantOf("Green Machine");
    await expect(
      inv.saveRecipe({ variantId: v.id, lines: [{ ingredientId: chicken, qty: "1", qtyUnit: "g" }, { ingredientId: chicken, qty: "2", qtyUnit: "g" }] }, staff),
    ).rejects.toThrow(/only once/);
    await expect(inv.saveRecipe({ variantId: v.id, lines: [{ ingredientId: chicken, qty: "0", qtyUnit: "g" }] }, staff)).rejects.toThrow(/how much/);
    await expect(inv.saveRecipe({ lines: [] }, staff)).rejects.toThrow();
  });

  it("summarises usage, wastage and spend", async () => {
    const from = new Date(Date.now() - 3600_000);
    const to = new Date(Date.now() + 3600_000);
    const rows = await inv.usageSummary(outletId, from, to);
    const c = rows.find((r) => r.ingredientId === chicken)!;
    expect(c.receivedMilli).toBe(4_000_000);
    expect(c.spentPaise).toBe(180_000);
    expect(c.usedMilli).toBe(300_000); // the rejected order nets to zero
    expect(Math.round(c.usedPaise)).toBe(13_500); // 300 g at ₹450/kg
    const l = rows.find((r) => r.ingredientId === lettuce)!;
    expect(l.wastedMilli).toBe(250_000);
    expect(l.countDiffMilli).toBe(2_750_000); // first count 3 kg, then -250 g
    expect((await inv.lowStock(outletId)).map((i) => i.name)).toContain("Test avocado");
  });
});
