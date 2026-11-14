import { describe, expect, it } from "vitest";
import { buildReorder, type PastItem } from "./reorder";
import type { CategoryDTO } from "./types";

const menu: CategoryDTO[] = [
  {
    id: "c",
    slug: "salads",
    name: "Salads",
    items: [
      {
        id: "bowl",
        slug: "bowl",
        name: "Paneer Bowl",
        description: null,
        diet: "veg",
        imageUrl: "/menu/bowl.webp",
        isFeatured: false,
        isBestseller: false,
        categorySlug: "salads",
        variants: [
          { id: "reg2", label: "Regular", portion: null, pricePaise: 32000, diet: "veg", nutrition: null },
          { id: "lg", label: "Large", portion: null, pricePaise: 40000, diet: "veg", nutrition: null },
        ],
        addonGroups: [
          { id: "g", name: "Proteins", minSelect: 0, maxSelect: 1, sort: 0, addons: [{ id: "tofu", name: "Chilli Tofu", pricePaise: 8000, diet: "veg", icon: "protein" }] },
        ],
      },
    ],
  },
];

const past = (p: Partial<PastItem>): PastItem => ({ menuItemId: "bowl", variantId: "reg", itemName: "Paneer Bowl", variantLabel: "Regular", quantity: 2, note: null, unitPricePaise: 30000, addons: [], ...p });

describe("order again", () => {
  it("rebuilds lines from today's menu, matching a renamed size id by its label", () => {
    const r = buildReorder([past({ addons: [{ addonId: "tofu", name: "Chilli Tofu", pricePaise: 8000 }], note: "less salt" })], menu);
    expect(r.unavailable).toEqual([]);
    expect(r.lines[0]).toMatchObject({ menuItemId: "bowl", variantId: "reg2", addOnIds: ["tofu"], quantity: 2, note: "less salt", unitPricePaise: 32000 });
    expect(r.changes).toEqual(["Paneer Bowl is ₹400 today (was ₹380)."]);
  });

  it("reports dishes and sizes that are gone, and drops extras that are", () => {
    const r = buildReorder(
      [
        past({ menuItemId: "old", itemName: "Old Wrap", variantLabel: null }),
        past({ variantId: "xl", variantLabel: "XL" }),
        past({ variantId: "lg", variantLabel: "Large", unitPricePaise: 40000, addons: [{ addonId: "feta", name: "Feta", pricePaise: 5000 }] }),
      ],
      menu,
    );
    expect(r.unavailable).toEqual([
      { name: "Old Wrap", reason: "not on the menu today" },
      { name: "Paneer Bowl (XL)", reason: "that size isn't offered any more" },
    ]);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ variantId: "lg", addOnIds: [] });
    expect(r.changes).toEqual(["Feta isn't available for Paneer Bowl today, so it was left out."]);
  });
});
