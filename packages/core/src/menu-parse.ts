/**
 * Turns the owner-supplied menu rows (seiketsu_menu.json) into structured
 * items + variants. Nothing is invented: anything the text does not state
 * is left null, and anything ambiguous is reported in `issues`.
 */
import { rupeesToPaise, type Paise } from "./money.ts";

export type SourceMenuRow = {
  category: string;
  name: string;
  price_text: string;
  description: string;
  nutrition_source_text: string;
  flags: string[];
  included: boolean;
};

export type Diet = "veg" | "egg" | "non_veg";

export type Nutrition = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
};

export type ParsedVariant = {
  /** e.g. "Small", "Paneer"; null when the item has a single unnamed option */
  label: string | null;
  portion: { amount: number; unit: "g" | "ml" } | null;
  pricePaise: Paise;
  /** Only set when the label itself states it (Paneer/Veg/Chicken/Egg). */
  diet: Diet | null;
  nutrition: Nutrition | null;
};

export type ParsedItem = {
  category: string;
  name: string;
  slug: string;
  description: string | null;
  isExtra: boolean;
  /** Item-level diet only when the source states it explicitly. */
  diet: Diet | null;
  variants: ParsedVariant[];
  needsReview: boolean;
  issues: string[];
};

const PRICE_SEGMENT =
  /^\s*([A-Za-z][A-Za-z ]*?)?\s*(?:\(\s*(\d+)\s*(g|ml)\s*\))?\s*(\d+)\s*$/;

const NUTRITION =
  /(\d+)\s*kcal.*?Protein\s*(\d+)\s*g.*?Carbs\s*(\d+)\s*g.*?Fat\s*(\d+)\s*g.*?Fib(?:er|re)\s*(\d+)\s*g/i;

const LABEL_DIET: Record<string, Diet> = {
  veg: "veg",
  paneer: "veg",
  egg: "egg",
  chicken: "non_veg",
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parsePriceText(text: string): Omit<ParsedVariant, "diet" | "nutrition">[] {
  const body = text.replace(/₹/g, "").trim();
  if (!body) throw new Error("Empty price text");
  return body.split("/").map((seg) => {
    const m = PRICE_SEGMENT.exec(seg);
    if (!m) throw new Error(`Unrecognised price segment "${seg.trim()}" in "${text}"`);
    const [, label, amount, unit, price] = m;
    return {
      label: label?.trim() || null,
      portion: amount ? { amount: Number(amount), unit: unit as "g" | "ml" } : null,
      pricePaise: rupeesToPaise(Number(price)),
    };
  });
}

/** Returns nutrition keyed by lower-case label ("" for an unlabelled block). */
export function parseNutritionText(text: string): Map<string, Nutrition> {
  const out = new Map<string, Nutrition>();
  if (!text.trim()) return out;
  for (const block of text.split("|")) {
    const labelMatch = /^\s*([A-Za-z]+)\s*:[\s:]*/.exec(block);
    const label = labelMatch ? labelMatch[1].toLowerCase() : "";
    const n = NUTRITION.exec(block);
    if (!n) throw new Error(`Unrecognised nutrition block "${block.trim()}"`);
    out.set(label, {
      kcal: Number(n[1]),
      proteinG: Number(n[2]),
      carbsG: Number(n[3]),
      fatG: Number(n[4]),
      fibreG: Number(n[5]),
    });
  }
  return out;
}

export function parseMenuRow(row: SourceMenuRow): ParsedItem {
  const issues: string[] = [];
  const isExtra = row.category === "Extras";
  const malformedName = row.flags.some((f) => f.includes("malformed product name"));
  if (malformedName) issues.push("Product name missing in source; needs owner correction.");

  const prices = parsePriceText(row.price_text);
  const nutrition = parseNutritionText(row.nutrition_source_text);

  const variants: ParsedVariant[] = prices.map((p) => {
    const key = p.label?.toLowerCase() ?? "";
    let n = nutrition.get(key) ?? null;
    // Single-option items carry one unlabelled nutrition block.
    if (!n && prices.length === 1 && nutrition.size === 1) n = nutrition.get("") ?? null;
    return { ...p, diet: p.label ? (LABEL_DIET[key] ?? null) : null, nutrition: n };
  });

  const priced = new Set(prices.map((p) => p.label?.toLowerCase() ?? ""));
  for (const label of nutrition.keys()) {
    if (label && !priced.has(label)) issues.push(`Nutrition given for "${label}" but no price for it.`);
  }
  if (!isExtra && variants.some((v) => !v.nutrition)) {
    issues.push("Some variants have no matching nutrition.");
  }

  let itemDiet: Diet | null = /\(veg\)/i.test(row.name) ? "veg" : null;
  // A single option labelled with its diet ("₹ Chicken 350") describes the
  // whole item, so drop the label to avoid a one-choice picker.
  if (variants.length === 1 && variants[0].diet) {
    itemDiet = variants[0].diet;
    variants[0].label = null;
  }

  return {
    category: row.category,
    name: row.name.trim(),
    slug: slugify(row.name),
    description: row.description?.trim() || null,
    isExtra,
    diet: itemDiet,
    variants,
    needsReview: issues.length > 0,
    issues,
  };
}

export function parseMenu(rows: SourceMenuRow[]): ParsedItem[] {
  const items = rows.filter((r) => r.included).map(parseMenuRow);
  const seen = new Map<string, number>();
  for (const it of items) {
    const n = seen.get(it.slug) ?? 0;
    seen.set(it.slug, n + 1);
    if (n > 0) it.slug = `${it.slug}-${n + 1}`;
  }
  return items;
}
