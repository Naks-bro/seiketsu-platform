/**
 * Menu diet filters. Only explicit marks count: a dish with no mark is never
 * shown as veg, because the menu does not say so.
 */
import type { Diet } from "./menu-parse";

export type DietFilter = { vegOnly: boolean; diet: Diet | null };

type Marked = { diet: Diet | null };
type Item = Marked & { variants: Marked[] };

/** Every diet a dish can be ordered as (a Paneer/Chicken bowl is both). */
export function itemDiets(item: Item): Set<Diet> {
  const s = new Set<Diet>();
  for (const v of item.variants) {
    const d = v.diet ?? item.diet;
    if (d) s.add(d);
  }
  if (s.size === 0 && item.diet) s.add(item.diet);
  return s;
}

export function wantedDiet(f: DietFilter): Diet | null {
  return f.vegOnly ? "veg" : f.diet;
}

export function matchesDiet(item: Item, f: DietFilter) {
  const want = wantedDiet(f);
  return want === null || itemDiets(item).has(want);
}

/** The variants a customer can pick under the filter. */
export function allowedVariants<V extends Marked>(item: Marked & { variants: V[] }, f: DietFilter): V[] {
  const want = wantedDiet(f);
  if (want === null) return item.variants;
  const hit = item.variants.filter((v) => (v.diet ?? item.diet) === want);
  return hit.length ? hit : item.variants;
}

/** Same rule for extras: under Veg only, an unmarked dip (it may hold egg) is hidden too. */
export function allowedAddon(addon: Marked, f: DietFilter) {
  const want = wantedDiet(f);
  return want === null || want !== "veg" || addon.diet === "veg";
}
