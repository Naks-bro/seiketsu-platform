import { describe, expect, it } from "vitest";
import { averageCost, costOf, foodCostBps, formatQty, recipeCost, stockLevel, toMilli, unitCostLabel, unitCostOf, usageFor } from "./inventory";

describe("quantities", () => {
  it("converts typed amounts into milli base units", () => {
    expect(toMilli(2.5, "kg", "g")).toBe(2_500_000);
    expect(toMilli(150, "g", "g")).toBe(150_000);
    expect(toMilli(1, "L", "ml")).toBe(1_000_000);
    expect(toMilli(0.5, "pcs", "pc")).toBe(500);
    expect(() => toMilli(1, "kg", "ml")).toThrow();
  });

  it("formats in the friendliest unit", () => {
    expect(formatQty(1_500_000, "g")).toBe("1.5 kg");
    expect(formatQty(250_000, "g")).toBe("250 g");
    expect(formatQty(-40_000, "ml")).toBe("-40 ml");
    expect(formatQty(12_000, "pc")).toBe("12 pcs");
  });
});

describe("costs", () => {
  it("works out unit cost from a purchase", () => {
    // ₹400 for 1 kg = 40 paise per gram
    expect(unitCostOf(40_000, 1_000_000)).toBe(40_000);
    expect(costOf(150_000, 40_000)).toBe(6_000); // 150 g = ₹60
    const rs = (p: number) => `Rs ${p / 100}`;
    expect(unitCostLabel(40_000, "g", rs)).toBe("Rs 400/kg");
    expect(unitCostLabel(700_000, "pc", rs)).toBe("Rs 7/pc");
  });

  it("averages cost across deliveries", () => {
    // 1 kg at ₹400 on hand, 1 kg arrives at ₹500 → ₹450/kg
    expect(averageCost(1_000_000, 40_000, 1_000_000, 50_000)).toBe(45_000);
    // nothing on hand (or negative): take the new price
    expect(averageCost(-20_000, 40_000, 1_000_000, 50_000)).toBe(50_000);
    expect(averageCost(500_000, null, 1_000_000, 50_000)).toBe(50_000);
  });

  it("costs a recipe only when every ingredient has a cost", () => {
    const costs = new Map<string, number | null>([["a", 40_000], ["b", 2_000], ["c", null]]);
    expect(recipeCost([{ ingredientId: "a", qtyMilli: 150_000 }, { ingredientId: "b", qtyMilli: 10_000 }], costs)).toBe(6_020);
    expect(recipeCost([{ ingredientId: "a", qtyMilli: 150_000 }, { ingredientId: "c", qtyMilli: 1 }], costs)).toBeNull();
    expect(foodCostBps(6_000, 30_000)).toBe(2_000);
  });
});

describe("stock", () => {
  it("flags low and out of stock", () => {
    expect(stockLevel(0, 100)).toBe("out");
    expect(stockLevel(100, 100)).toBe("low");
    expect(stockLevel(101, 100)).toBe("ok");
    expect(stockLevel(5, null)).toBe("ok");
  });

  it("adds up dish and extra recipes times quantity", () => {
    const variants = new Map([["v1", [{ ingredientId: "chicken", qtyMilli: 150_000 }, { ingredientId: "oil", qtyMilli: 10_000 }]]]);
    const extras = new Map([["egg", [{ ingredientId: "eggs", qtyMilli: 1_000 }]]]);
    const use = usageFor(
      [
        { variantId: "v1", quantity: 2, addonIds: ["egg"] },
        { variantId: "v2", quantity: 1, addonIds: [] }, // no recipe yet
        { variantId: "v1", quantity: 1, addonIds: [null] },
      ],
      variants,
      extras,
    );
    expect(Object.fromEntries(use)).toEqual({ chicken: 450_000, oil: 30_000, eggs: 2_000 });
  });
});
