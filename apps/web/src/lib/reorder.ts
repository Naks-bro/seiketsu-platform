/**
 * "Order again": turns a past order into cart lines from today's menu. Dishes that left the menu, sizes no longer
 * offered and extras that are gone are reported rather than guessed, and today's prices apply (the server re-prices
 * at checkout anyway).
 */
import type { CartLine } from "./cart";
import type { CategoryDTO, MenuItemDTO } from "./types";

export type PastItem = {
  menuItemId: string | null;
  variantId: string | null;
  itemName: string;
  variantLabel: string | null;
  quantity: number;
  note: string | null;
  unitPricePaise: number;
  addons: { addonId: string | null; name: string; pricePaise: number }[];
};

export type Reorder = {
  lines: Omit<CartLine, "key">[];
  /** Dishes we could not add, with why. */
  unavailable: { name: string; reason: string }[];
  /** Things that differ from last time: a dropped extra, a new price. */
  changes: string[];
};

const rupees = (p: number) => `₹${(p / 100).toFixed(2).replace(/\.00$/, "")}`;
const sameLabel = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export function buildReorder(items: PastItem[], menu: CategoryDTO[]): Reorder {
  const byId = new Map<string, MenuItemDTO>();
  for (const c of menu) for (const i of c.items) byId.set(i.id, i);
  const out: Reorder = { lines: [], unavailable: [], changes: [] };

  for (const past of items) {
    const label = past.variantLabel ? `${past.itemName} (${past.variantLabel})` : past.itemName;
    const item = past.menuItemId ? byId.get(past.menuItemId) : undefined;
    if (!item) {
      out.unavailable.push({ name: label, reason: "not on the menu today" });
      continue;
    }
    // Same size by id; failing that, the size with the same name; a one-size dish matches itself.
    const variant =
      item.variants.find((v) => v.id === past.variantId) ??
      item.variants.find((v) => past.variantLabel && sameLabel(v.label, past.variantLabel)) ??
      (item.variants.length === 1 && !past.variantLabel ? item.variants[0] : undefined);
    if (!variant) {
      out.unavailable.push({ name: label, reason: "that size isn't offered any more" });
      continue;
    }

    const groups = item.addonGroups;
    const picked: { id: string; name: string; pricePaise: number; icon: string | null; groupId: string }[] = [];
    for (const a of past.addons) {
      const group = groups.find((g) => g.addons.some((x) => x.id === a.addonId));
      const now = group?.addons.find((x) => x.id === a.addonId);
      if (!group || !now) {
        out.changes.push(`${a.name} isn't available for ${item.name} today, so it was left out.`);
        continue;
      }
      if (picked.filter((p) => p.groupId === group.id).length >= group.maxSelect) {
        out.changes.push(`${a.name} was left out: ${group.name} allows ${group.maxSelect} now.`);
        continue;
      }
      if (!picked.some((p) => p.id === now.id)) picked.push({ id: now.id, name: now.name, pricePaise: now.pricePaise, icon: now.icon, groupId: group.id });
    }

    const was = past.unitPricePaise + past.addons.reduce((s, a) => s + a.pricePaise, 0);
    const is = variant.pricePaise + picked.reduce((s, a) => s + a.pricePaise, 0);
    if (is !== was && picked.length === past.addons.length) out.changes.push(`${item.name} is ${rupees(is)} today (was ${rupees(was)}).`);

    out.lines.push({
      menuItemId: item.id,
      variantId: variant.id,
      addOnIds: picked.map((p) => p.id),
      quantity: Math.min(20, Math.max(1, past.quantity)),
      ...(past.note ? { note: past.note } : {}),
      name: item.name,
      variantLabel: variant.label,
      unitPricePaise: variant.pricePaise,
      addOns: picked.map(({ id, name, pricePaise, icon }) => ({ id, name, pricePaise, icon })),
      diet: variant.diet ?? item.diet,
      imageUrl: item.imageUrl,
      categorySlug: item.categorySlug,
    });
  }
  return out;
}
