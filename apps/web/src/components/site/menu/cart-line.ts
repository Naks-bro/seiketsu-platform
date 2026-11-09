import type { CartLine } from "@/lib/cart";
import type { AddonDTO, MenuItemDTO, VariantDTO } from "@/lib/types";

/** Display snapshot for the cart. The server re-prices every line at checkout. */
export function cartLineFor(item: MenuItemDTO, variant: VariantDTO, chosen: AddonDTO[], quantity: number, note?: string): Omit<CartLine, "key"> {
  return {
    menuItemId: item.id,
    variantId: variant.id,
    addOnIds: chosen.map((a) => a.id),
    quantity,
    note: note?.trim() || undefined,
    name: item.name,
    variantLabel: [variant.label, variant.portion].filter(Boolean).join(" · ") || null,
    unitPricePaise: variant.pricePaise,
    addOns: chosen.map((a) => ({ id: a.id, name: a.name, pricePaise: a.pricePaise, icon: a.icon })),
    diet: variant.diet ?? item.diet,
    imageUrl: item.imageUrl,
    categorySlug: item.categorySlug,
  };
}

export const isSimple = (item: MenuItemDTO) => item.variants.length === 1 && item.addonGroups.every((g) => g.addons.length === 0);
