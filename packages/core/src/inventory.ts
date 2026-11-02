/**
 * Stock maths. Quantities are integer thousandths of the ingredient's base unit
 * (g, ml or pc), so 1.5 kg = 1_500_000 and half an egg = 500. Costs are integer
 * thousandths of a paisa per base unit (₹400/kg = 40 paise/g = 40_000).
 * Nothing here invents quantities: recipes and stock come from the owner.
 */

export const STOCK_UNITS = ["g", "ml", "pc"] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

/** Units staff can type in, per base unit, and how many base units each is. */
export const INPUT_UNITS: Record<StockUnit, { label: string; factor: number }[]> = {
  g: [
    { label: "kg", factor: 1000 },
    { label: "g", factor: 1 },
  ],
  ml: [
    { label: "L", factor: 1000 },
    { label: "ml", factor: 1 },
  ],
  pc: [{ label: "pcs", factor: 1 }],
};

export const UNIT_NAME: Record<StockUnit, string> = { g: "weight (kg / g)", ml: "volume (L / ml)", pc: "count (pieces)" };

/** Converts what someone typed ("2.5" kg) into milli base units. */
export function toMilli(amount: number, inputUnit: string, unit: StockUnit): number {
  const u = INPUT_UNITS[unit].find((x) => x.label === inputUnit);
  if (!u) throw new Error(`"${inputUnit}" is not a unit for ${UNIT_NAME[unit]}`);
  if (!Number.isFinite(amount)) throw new Error("Enter a number");
  return Math.round(amount * u.factor * 1000);
}

function trim(n: number, maxDecimals: number) {
  return Number(n.toFixed(maxDecimals)).toLocaleString("en-IN", { maximumFractionDigits: maxDecimals });
}

/** 1_500_000 g → "1.5 kg", 250_000 g → "250 g", 2_500 pc → "2.5 pcs". */
export function formatQty(milli: number, unit: StockUnit): string {
  const sign = milli < 0 ? "-" : "";
  const abs = Math.abs(milli) / 1000;
  if (unit === "pc") return `${sign}${trim(abs, 2)} pcs`;
  const [big, small] = unit === "g" ? ["kg", "g"] : ["L", "ml"];
  return abs >= 1000 ? `${sign}${trim(abs / 1000, 2)} ${big}` : `${sign}${trim(abs, 1)} ${small}`;
}

/**
 * Price label for a unit cost. Milli-paise per gram is numerically paise per kg,
 * so ₹/kg and ₹/L read directly; pieces are shown per piece.
 */
export function unitCostLabel(costMilliPaise: number, unit: StockUnit, formatPaise: (p: number) => string): string {
  if (unit === "pc") return `${formatPaise(costMilliPaise / 1000)}/pc`;
  return `${formatPaise(costMilliPaise)}/${unit === "g" ? "kg" : "L"}`;
}

/** Cost per base unit of a purchase, in milli-paise. */
export function unitCostOf(totalPaise: number, qtyMilli: number): number {
  if (qtyMilli <= 0) throw new Error("Quantity must be more than zero");
  return Math.round((totalPaise * 1_000_000) / qtyMilli);
}

/** Paise for a quantity at a unit cost (not rounded, so recipe lines can be summed first). */
export function costOf(qtyMilli: number, unitCostMilliPaise: number): number {
  return (qtyMilli * unitCostMilliPaise) / 1_000_000;
}

/**
 * Moving-average cost after receiving stock. Stock already below zero (sales
 * recorded before the delivery was entered) does not drag the average.
 */
export function averageCost(stockMilli: number, currentCost: number | null, addMilli: number, addTotalPaise: number): number {
  const incoming = unitCostOf(addTotalPaise, addMilli);
  if (currentCost === null || stockMilli <= 0) return incoming;
  return Math.round((stockMilli * currentCost + addTotalPaise * 1_000_000) / (stockMilli + addMilli));
}

export type StockLevel = "out" | "low" | "ok";

export function stockLevel(stockMilli: number, reorderMilli: number | null): StockLevel {
  if (stockMilli <= 0) return "out";
  if (reorderMilli !== null && stockMilli <= reorderMilli) return "low";
  return "ok";
}

export type RecipeLine = { ingredientId: string; qtyMilli: number };
export type SoldLine = { variantId: string | null; quantity: number; addonIds: (string | null)[] };

/**
 * Total ingredient use for an order: each dish's recipe (per size) plus each
 * extra's recipe, times the quantity ordered. Dishes without a recipe use nothing.
 */
export function usageFor(lines: SoldLine[], variantRecipes: Map<string, RecipeLine[]>, addonRecipes: Map<string, RecipeLine[]>) {
  const use = new Map<string, number>();
  const add = (recipe: RecipeLine[] | undefined, times: number) => {
    for (const r of recipe ?? []) use.set(r.ingredientId, (use.get(r.ingredientId) ?? 0) + r.qtyMilli * times);
  };
  for (const l of lines) {
    if (l.variantId) add(variantRecipes.get(l.variantId), l.quantity);
    for (const a of l.addonIds) if (a) add(addonRecipes.get(a), l.quantity);
  }
  return use;
}

/** Ingredient cost of one portion; null when any ingredient has no cost yet. */
export function recipeCost(lines: RecipeLine[], costs: Map<string, number | null>): number | null {
  let total = 0;
  for (const l of lines) {
    const c = costs.get(l.ingredientId);
    if (c === null || c === undefined) return null;
    total += costOf(l.qtyMilli, c);
  }
  return Math.round(total);
}

/** Food cost as a share of the selling price, in basis points (3000 = 30%). */
export function foodCostBps(costPaise: number, pricePaise: number): number | null {
  return pricePaise > 0 ? Math.round((costPaise / pricePaise) * 10_000) : null;
}
