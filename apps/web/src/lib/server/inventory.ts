import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  addons,
  getDb,
  ingredients,
  orderItemAddons,
  orderItems,
  orders,
  recipeLines,
  stockMovements,
  suppliers,
  type Db,
} from "@seiketsu/db";
import { averageCost, STOCK_UNITS, toMilli, usageFor, type RecipeLine } from "@seiketsu/core/inventory";
import { audit } from "./audit";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export class InventoryError extends Error {}

const MAX_QTY = 1_000_000_000_000; // a million kg, litres or pieces: anything bigger is a typo

const amount = z.coerce.number({ message: "Enter a number" }).finite().min(0, "Cannot be negative").max(1_000_000, "That number is too large");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

// ── Ingredients & suppliers ────────────────────────────────────────

export const ingredientInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter the ingredient's name").max(60),
  unit: z.enum(STOCK_UNITS),
  /** reorder level, typed in `reorderUnit` */
  reorder: z.union([z.literal(""), amount]).optional(),
  reorderUnit: z.string().max(5).optional(),
  supplierId: z.union([z.literal(""), z.string().uuid()]).optional(),
});

async function ownSupplier(db: Db | Tx, outletId: string, supplierId: string | undefined | null) {
  if (!supplierId) return null;
  const [s] = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.outletId, outletId)));
  if (!s) throw new InventoryError("Supplier not found.");
  return s.id;
}

function isUniqueViolation(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export async function saveIngredient(raw: unknown, staff: { id: string; outletId: string }) {
  const input = ingredientInput.parse(raw);
  const db = await getDb();
  const supplierId = await ownSupplier(db, staff.outletId, input.supplierId);

  if (input.id) {
    const [current] = await db.select().from(ingredients).where(and(eq(ingredients.id, input.id), eq(ingredients.outletId, staff.outletId)));
    if (!current) throw new InventoryError("Ingredient not found.");
    // The unit can only change before anything uses it, or the stored numbers stop meaning anything.
    if (current.unit !== input.unit) {
      const [used] = await db.select({ n: sql<number>`count(*)::int` }).from(stockMovements).where(eq(stockMovements.ingredientId, current.id));
      const [inRecipe] = await db.select({ n: sql<number>`count(*)::int` }).from(recipeLines).where(eq(recipeLines.ingredientId, current.id));
      if (used.n || inRecipe.n) throw new InventoryError("The unit can't change once stock or recipes use this ingredient. Add a new ingredient instead.");
    }
  }
  const reorderMilli = input.reorder === undefined || input.reorder === "" ? null : toMilli(input.reorder, input.reorderUnit ?? "", input.unit);
  const values = { name: input.name, unit: input.unit, reorderMilli, supplierId };

  try {
    if (input.id) {
      await db.update(ingredients).set(values).where(and(eq(ingredients.id, input.id), eq(ingredients.outletId, staff.outletId)));
      await audit(db, { actorId: staff.id, outletId: staff.outletId, action: "ingredient.update", entity: "ingredient", entityId: input.id, data: values });
      return input.id;
    }
    const [row] = await db.insert(ingredients).values({ ...values, outletId: staff.outletId }).returning({ id: ingredients.id });
    await audit(db, { actorId: staff.id, outletId: staff.outletId, action: "ingredient.create", entity: "ingredient", entityId: row.id, data: values });
    return row.id;
  } catch (err) {
    if (isUniqueViolation(err)) throw new InventoryError(`There is already an ingredient called "${input.name}".`);
    throw err;
  }
}

export async function setIngredientActive(ingredientId: string, active: boolean, staff: { id: string; outletId: string }) {
  const db = await getDb();
  await db.update(ingredients).set({ isActive: active }).where(and(eq(ingredients.id, ingredientId), eq(ingredients.outletId, staff.outletId)));
  await audit(db, { actorId: staff.id, outletId: staff.outletId, action: active ? "ingredient.restore" : "ingredient.archive", entity: "ingredient", entityId: ingredientId });
}

export const supplierInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter the supplier's name").max(80),
  phone: optionalText(20),
  email: z
    .union([z.literal(""), z.string().trim().email("Enter a valid email")])
    .optional()
    .transform((v) => v || null),
  notes: optionalText(300),
});

export async function saveSupplier(raw: unknown, staff: { id: string; outletId: string }) {
  const input = supplierInput.parse(raw);
  const db = await getDb();
  const values = { name: input.name, phone: input.phone, email: input.email, notes: input.notes };
  if (input.id) {
    const r = await db
      .update(suppliers)
      .set(values)
      .where(and(eq(suppliers.id, input.id), eq(suppliers.outletId, staff.outletId)))
      .returning({ id: suppliers.id });
    if (!r.length) throw new InventoryError("Supplier not found.");
    await audit(db, { actorId: staff.id, outletId: staff.outletId, action: "supplier.update", entity: "supplier", entityId: input.id });
    return input.id;
  }
  const [row] = await db.insert(suppliers).values({ ...values, outletId: staff.outletId }).returning({ id: suppliers.id });
  await audit(db, { actorId: staff.id, outletId: staff.outletId, action: "supplier.create", entity: "supplier", entityId: row.id });
  return row.id;
}

// ── Stock movements ────────────────────────────────────────────────

export const movementInput = z
  .object({
    ingredientId: z.string().uuid("Choose an ingredient"),
    kind: z.enum(["purchase", "wastage", "count"]),
    qty: amount,
    qtyUnit: z.string().max(5),
    /** deliveries: total on the bill, in rupees */
    total: z.union([z.literal(""), amount]).optional(),
    supplierId: z.union([z.literal(""), z.string().uuid()]).optional(),
    reference: optionalText(60),
    note: optionalText(200),
  })
  .refine((v) => v.kind === "count" || v.qty > 0, { message: "Enter how much", path: ["qty"] });

/**
 * Records a delivery, wastage or stock count. The ingredient row is locked so
 * the running total and the ledger always agree.
 */
export async function recordMovement(raw: unknown, staff: { id: string; outletId: string }) {
  const input = movementInput.parse(raw);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [ing] = await tx
      .select()
      .from(ingredients)
      .where(and(eq(ingredients.id, input.ingredientId), eq(ingredients.outletId, staff.outletId)))
      .for("update");
    if (!ing) throw new InventoryError("Ingredient not found.");
    const qtyMilli = toMilli(input.qty, input.qtyUnit, ing.unit);
    if (qtyMilli > MAX_QTY) throw new InventoryError("That quantity is too large.");

    let delta: number;
    let cost = ing.costMilliPaise;
    let totalPaise: number | null = null;
    let supplierId: string | null = null;
    if (input.kind === "purchase") {
      delta = qtyMilli;
      supplierId = await ownSupplier(tx, staff.outletId, input.supplierId);
      if (input.total !== undefined && input.total !== "") {
        totalPaise = Math.round(input.total * 100);
        cost = averageCost(ing.stockMilli, ing.costMilliPaise, qtyMilli, totalPaise);
      }
    } else if (input.kind === "wastage") {
      delta = -qtyMilli;
    } else {
      // A count sets the stock to what is actually on the shelf.
      delta = qtyMilli - ing.stockMilli;
    }
    const after = ing.stockMilli + delta;
    await tx
      .update(ingredients)
      .set({ stockMilli: after, costMilliPaise: cost, ...(supplierId && !ing.supplierId ? { supplierId } : {}) })
      .where(eq(ingredients.id, ing.id));
    const [m] = await tx
      .insert(stockMovements)
      .values({
        outletId: staff.outletId,
        ingredientId: ing.id,
        kind: input.kind,
        deltaMilli: delta,
        stockAfterMilli: after,
        costMilliPaise: cost,
        totalPaise,
        supplierId,
        reference: input.reference,
        note: input.note,
        staffId: staff.id,
      })
      .returning();
    return { movement: m, ingredient: { ...ing, stockMilli: after, costMilliPaise: cost } };
  });
}

/** Applies several ingredient changes for an order, locking rows in a fixed order to avoid deadlocks. */
async function applyOrderUsage(tx: Tx, outletId: string, orderId: string, use: Map<string, number>, kind: "sale" | "return") {
  const ids = [...use.keys()].sort();
  if (!ids.length) return 0;
  const rows = await tx
    .select()
    .from(ingredients)
    .where(and(inArray(ingredients.id, ids), eq(ingredients.outletId, outletId)))
    .orderBy(asc(ingredients.id))
    .for("update");
  for (const ing of rows) {
    const delta = kind === "sale" ? -use.get(ing.id)! : use.get(ing.id)!;
    const after = ing.stockMilli + delta;
    await tx.update(ingredients).set({ stockMilli: after }).where(eq(ingredients.id, ing.id));
    await tx.insert(stockMovements).values({ outletId, ingredientId: ing.id, kind, deltaMilli: delta, stockAfterMilli: after, costMilliPaise: ing.costMilliPaise, orderId });
  }
  return rows.length;
}

/**
 * Takes a paid order's ingredients out of stock, once. Safe to call from every
 * payment path and from the cron sweep: the stock_deducted_at marker makes
 * repeats a no-op. Dishes without a recipe simply use nothing.
 */
export async function deductStockForOrder(orderId: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [o] = await tx
      .update(orders)
      .set({ stockDeductedAt: new Date() })
      .where(and(eq(orders.id, orderId), isNull(orders.stockDeductedAt), inArray(orders.paymentState, ["paid", "partially_refunded"])))
      .returning({ id: orders.id, outletId: orders.outletId });
    if (!o) return 0;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    if (!items.length) return 0;
    const extras = await tx.select().from(orderItemAddons).where(inArray(orderItemAddons.orderItemId, items.map((i) => i.id)));
    const variantIds = items.map((i) => i.variantId).filter((v): v is string => !!v);
    const addonIds = extras.map((e) => e.addonId).filter((a): a is string => !!a);
    const conds = [];
    if (variantIds.length) conds.push(inArray(recipeLines.variantId, variantIds));
    if (addonIds.length) conds.push(inArray(recipeLines.addonId, addonIds));
    if (!conds.length) return 0;
    const recipes = await tx
      .select({ r: recipeLines })
      .from(recipeLines)
      .innerJoin(ingredients, eq(ingredients.id, recipeLines.ingredientId))
      .where(and(eq(ingredients.outletId, o.outletId), conds.length === 1 ? conds[0] : sql`(${conds[0]} or ${conds[1]})`));
    const byVariant = new Map<string, RecipeLine[]>();
    const byAddon = new Map<string, RecipeLine[]>();
    for (const { r } of recipes) {
      const map = r.variantId ? byVariant : byAddon;
      const key = (r.variantId ?? r.addonId)!;
      map.set(key, [...(map.get(key) ?? []), { ingredientId: r.ingredientId, qtyMilli: r.qtyMilli }]);
    }
    const use = usageFor(
      items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, addonIds: extras.filter((e) => e.orderItemId === i.id).map((e) => e.addonId) })),
      byVariant,
      byAddon,
    );
    return applyOrderUsage(tx, o.outletId, o.id, use, "sale");
  });
}

/**
 * Puts stock back for an order rejected before the kitchen started it. Cancelled
 * orders are not reversed automatically: the food may already have been made.
 */
export async function returnStockForOrder(orderId: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [o] = await tx
      .update(orders)
      .set({ stockDeductedAt: null })
      .where(and(eq(orders.id, orderId), isNotNull(orders.stockDeductedAt), eq(orders.status, "rejected")))
      .returning({ id: orders.id, outletId: orders.outletId });
    if (!o) return 0;
    const moves = await tx.select().from(stockMovements).where(eq(stockMovements.orderId, o.id));
    const net = new Map<string, number>();
    for (const m of moves) net.set(m.ingredientId, (net.get(m.ingredientId) ?? 0) - m.deltaMilli);
    for (const [k, v] of net) if (v <= 0) net.delete(k);
    return applyOrderUsage(tx, o.outletId, o.id, net, "return");
  });
}

/** Never lets a stock problem break a payment or a sale; the cron sweep retries later. */
export async function deductStockSafely(orderId: string) {
  try {
    await deductStockForOrder(orderId);
  } catch (err) {
    console.error("[inventory] could not deduct stock for order", orderId, err);
  }
}

/** Cron: catch paid orders whose stock was not deducted (for example after a timeout). */
export async function sweepStockDeductions(limit = 50) {
  const db = await getDb();
  const since = new Date(Date.now() - 2 * 86_400_000);
  const pending = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        isNull(orders.stockDeductedAt),
        inArray(orders.paymentState, ["paid", "partially_refunded"]),
        notInArray(orders.status, ["rejected", "cancelled", "expired", "payment_failed", "pending_payment"]),
        gte(orders.placedAt, since),
      ),
    )
    .limit(limit);
  let done = 0;
  for (const o of pending) {
    try {
      await deductStockForOrder(o.id);
      done++;
    } catch (err) {
      console.error("[inventory] sweep failed for", o.id, err);
    }
  }
  return done;
}

// ── Recipes ────────────────────────────────────────────────────────

export const recipeInput = z
  .object({
    variantId: z.string().uuid().optional(),
    addonId: z.string().uuid().optional(),
    lines: z
      .array(
        z.object({
          ingredientId: z.string().uuid("Choose an ingredient"),
          qty: amount.refine((n) => n > 0, "Enter how much"),
          qtyUnit: z.string().max(5),
        }),
      )
      .max(40),
  })
  .refine((v) => !!v.variantId !== !!v.addonId, "Choose a dish size or an extra");

/** Replaces a dish size's (or an extra's) recipe. Quantities are what the owner enters; nothing is guessed. */
export async function saveRecipe(raw: unknown, staff: { id: string; outletId: string }) {
  const input = recipeInput.parse(raw);
  const db = await getDb();
  const ids = [...new Set(input.lines.map((l) => l.ingredientId))];
  if (ids.length !== input.lines.length) throw new InventoryError("Each ingredient can appear only once in a recipe.");
  const own = ids.length ? await db.select().from(ingredients).where(and(inArray(ingredients.id, ids), eq(ingredients.outletId, staff.outletId))) : [];
  if (own.length !== ids.length) throw new InventoryError("Ingredient not found.");
  const unitOf = new Map(own.map((i) => [i.id, i.unit]));
  const rows = input.lines.map((l) => {
    const qtyMilli = toMilli(l.qty, l.qtyUnit, unitOf.get(l.ingredientId)!);
    if (qtyMilli < 1 || qtyMilli > 100_000_000) throw new InventoryError("A recipe quantity is out of range.");
    return { variantId: input.variantId ?? null, addonId: input.addonId ?? null, ingredientId: l.ingredientId, qtyMilli };
  });
  await db.transaction(async (tx) => {
    await tx.delete(recipeLines).where(input.variantId ? eq(recipeLines.variantId, input.variantId) : eq(recipeLines.addonId, input.addonId!));
    if (rows.length) await tx.insert(recipeLines).values(rows);
    await audit(tx, {
      actorId: staff.id,
      outletId: staff.outletId,
      action: "recipe.save",
      entity: input.variantId ? "variant" : "addon",
      entityId: input.variantId ?? input.addonId!,
      data: rows.map((r) => ({ ingredientId: r.ingredientId, qtyMilli: r.qtyMilli })),
    });
  });
}

// ── Reads ──────────────────────────────────────────────────────────

export async function listIngredients(outletId: string, opts: { includeArchived?: boolean } = {}) {
  const db = await getDb();
  return db
    .select({ ing: ingredients, supplier: suppliers.name })
    .from(ingredients)
    .leftJoin(suppliers, eq(suppliers.id, ingredients.supplierId))
    .where(and(eq(ingredients.outletId, outletId), opts.includeArchived ? undefined : eq(ingredients.isActive, true)))
    .orderBy(asc(ingredients.name));
}

export async function listSuppliers(outletId: string) {
  const db = await getDb();
  return db.select().from(suppliers).where(eq(suppliers.outletId, outletId)).orderBy(asc(suppliers.name));
}

export async function lowStock(outletId: string) {
  const db = await getDb();
  return db
    .select()
    .from(ingredients)
    .where(
      and(
        eq(ingredients.outletId, outletId),
        eq(ingredients.isActive, true),
        sql`(${ingredients.stockMilli} <= 0 or (${ingredients.reorderMilli} is not null and ${ingredients.stockMilli} <= ${ingredients.reorderMilli}))`,
      ),
    )
    .orderBy(asc(ingredients.name));
}

export async function recentMovements(outletId: string, opts: { ingredientId?: string; from?: Date; to?: Date; limit?: number } = {}) {
  const db = await getDb();
  return db
    .select({ m: stockMovements, ingredient: ingredients.name, unit: ingredients.unit, supplier: suppliers.name, orderNumber: orders.orderNumber })
    .from(stockMovements)
    .innerJoin(ingredients, eq(ingredients.id, stockMovements.ingredientId))
    .leftJoin(suppliers, eq(suppliers.id, stockMovements.supplierId))
    .leftJoin(orders, eq(orders.id, stockMovements.orderId))
    .where(
      and(
        eq(stockMovements.outletId, outletId),
        opts.ingredientId ? eq(stockMovements.ingredientId, opts.ingredientId) : undefined,
        opts.from ? gte(stockMovements.createdAt, opts.from) : undefined,
        opts.to ? lt(stockMovements.createdAt, opts.to) : undefined,
      ),
    )
    .orderBy(desc(stockMovements.id))
    .limit(opts.limit ?? 200);
}

const kindList = (kinds: string[]) => sql.join(kinds.map((k) => sql`${k}`), sql`, `);
const sumQty = (kinds: string[], sign: 1 | -1) =>
  sql<number>`coalesce(sum(${sign} * ${stockMovements.deltaMilli}) filter (where ${stockMovements.kind}::text in (${kindList(kinds)})), 0)::float8`;
const sumValue = (kinds: string[], sign: 1 | -1) =>
  sql<number>`coalesce(sum(${sign} * ${stockMovements.deltaMilli}::numeric * coalesce(${stockMovements.costMilliPaise}, 0) / 1000000) filter (where ${stockMovements.kind}::text in (${kindList(kinds)})), 0)::float8`;

/** Per ingredient over a period: used in sales, wasted, received, and what that cost. */
export async function usageSummary(outletId: string, from: Date, to: Date) {
  const db = await getDb();
  return db
    .select({
      ingredientId: ingredients.id,
      name: ingredients.name,
      unit: ingredients.unit,
      usedMilli: sumQty(["sale", "return"], -1),
      usedPaise: sumValue(["sale", "return"], -1),
      wastedMilli: sumQty(["wastage"], -1),
      wastedPaise: sumValue(["wastage"], -1),
      receivedMilli: sumQty(["purchase"], 1),
      spentPaise: sql<number>`coalesce(sum(${stockMovements.totalPaise}) filter (where ${stockMovements.kind} = 'purchase'), 0)::int`,
      countDiffMilli: sumQty(["count", "adjustment"], 1),
    })
    .from(stockMovements)
    .innerJoin(ingredients, eq(ingredients.id, stockMovements.ingredientId))
    .where(and(eq(stockMovements.outletId, outletId), gte(stockMovements.createdAt, from), lt(stockMovements.createdAt, to)))
    .groupBy(ingredients.id, ingredients.name, ingredients.unit)
    .orderBy(asc(ingredients.name));
}

/** Every recipe line that uses this outlet's ingredients. */
export async function allRecipes(outletId: string) {
  const db = await getDb();
  return db
    .select({ r: recipeLines, unit: ingredients.unit, name: ingredients.name, cost: ingredients.costMilliPaise })
    .from(recipeLines)
    .innerJoin(ingredients, eq(ingredients.id, recipeLines.ingredientId))
    .where(eq(ingredients.outletId, outletId))
    .orderBy(asc(ingredients.name));
}

export async function addonList() {
  const db = await getDb();
  return db.select().from(addons).orderBy(asc(addons.sort));
}
