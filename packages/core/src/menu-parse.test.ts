import { describe, expect, it } from "vitest";
import rows from "../../db/data/seiketsu_menu.json" with { type: "json" };
import { parseMenu, parseNutritionText, parsePriceText, type SourceMenuRow } from "./menu-parse.ts";

const items = parseMenu(rows as SourceMenuRow[]);
const byName = (name: string) => items.find((i) => i.name === name)!;

describe("menu parser on the real Seiketsu menu", () => {
  it("parses every row without throwing", () => {
    expect(items).toHaveLength(53);
    expect(items.filter((i) => i.isExtra)).toHaveLength(14);
  });

  it("gives every item at least one priced variant", () => {
    for (const it of items) {
      expect(it.variants.length).toBeGreaterThan(0);
      for (const v of it.variants) expect(v.pricePaise).toBeGreaterThan(0);
    }
  });

  it("keeps size variants separate", () => {
    const it = byName("Classic French Salad Bowl (Veg)");
    expect(it.variants.map((v) => [v.label, v.portion?.amount, v.pricePaise])).toEqual([
      ["Small", 300, 30000],
      ["Large", 400, 35000],
    ]);
    expect(it.variants[0].nutrition).toEqual({ kcal: 240, proteinG: 7, carbsG: 23, fatG: 14, fibreG: 8 });
    expect(it.variants[1].nutrition?.kcal).toBe(320);
    expect(it.diet).toBe("veg");
  });

  it("keeps protein variants separate with their own diet", () => {
    const it = byName("Herbed Paneer / Chicken Protein Salad Bowl");
    expect(it.variants.map((v) => [v.label, v.diet, v.pricePaise, v.nutrition?.proteinG])).toEqual([
      ["Paneer", "veg", 30000, 32],
      ["Chicken", "non_veg", 35000, 49],
    ]);
    expect(it.diet).toBeNull(); // mixed: diet lives on the variant
  });

  it("handles the double colon and Fibre spelling in the source", () => {
    const n = parseNutritionText("Paneer: : 570 kcal • Protein 32 g • Carbs 37 g • Fat 33 g • Fibre 11 g");
    expect(n.get("paneer")?.fibreG).toBe(11);
  });

  it("collapses a single diet-labelled price into the item", () => {
    const it = byName("Grilled Chicken Hummus Wrap");
    expect(it.variants).toHaveLength(1);
    expect(it.variants[0].label).toBeNull();
    expect(it.diet).toBe("non_veg");
    expect(it.variants[0].nutrition?.kcal).toBe(520);
  });

  it("does not invent a diet when the source does not state one", () => {
    expect(byName("Mediterranean Salad Bowl").diet).toBeNull();
    expect(byName("Chocolate Smoothie").diet).toBeNull();
  });

  it("parses juice volumes", () => {
    expect(byName("Green Machine").variants[0].portion).toEqual({ amount: 300, unit: "ml" });
  });

  it("flags the two unnamed salads for review and does not guess the Small price", () => {
    const flagged = items.filter((i) => i.needsReview);
    expect(flagged.map((i) => i.name).sort()).toEqual(["Large (400g) 320", "Large (450g) 350"]);
    for (const it of flagged) {
      expect(it.variants.map((v) => v.label)).toEqual(["Large"]);
      expect(it.issues.join(" ")).toMatch(/small/i);
    }
  });

  it("parses extras as single-price items", () => {
    expect(byName("Guacamole").variants).toEqual([
      { label: null, portion: null, pricePaise: 10000, diet: null, nutrition: null },
    ]);
  });

  it("produces unique slugs", () => {
    expect(new Set(items.map((i) => i.slug)).size).toBe(items.length);
  });

  it("rejects price text it does not understand", () => {
    expect(() => parsePriceText("₹ market price")).toThrow();
  });
});
