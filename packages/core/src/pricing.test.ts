import { describe, expect, it } from "vitest";
import { computeQuote, type PricingSettings } from "./pricing.ts";

const base: PricingSettings = {
  tax: { enabled: false, rateBps: 0, inclusive: false },
  deliveryFeePaise: 4000,
  freeDeliveryAbovePaise: null,
  minOrderPaise: 20000,
};

const lines = [
  { unitPricePaise: 30000, addOnPricesPaise: [8000, 3000], quantity: 2 }, // (300 + 80 + 30) x 2
  { unitPricePaise: 22000, addOnPricesPaise: [], quantity: 1 },
];

describe("computeQuote", () => {
  it("adds add-ons per unit and multiplies by quantity", () => {
    const q = computeQuote(lines, base, "pickup");
    expect(q.lineTotalsPaise).toEqual([82000, 22000]);
    expect(q.subtotalPaise).toBe(104000);
    expect(q.totalPaise).toBe(104000);
    expect(q.deliveryFeePaise).toBe(0);
  });

  it("charges delivery only for delivery orders", () => {
    expect(computeQuote(lines, base, "delivery").totalPaise).toBe(108000);
  });

  it("waives delivery above the free threshold", () => {
    const q = computeQuote(lines, { ...base, freeDeliveryAbovePaise: 100000 }, "delivery");
    expect(q.deliveryFeePaise).toBe(0);
  });

  it("adds exclusive GST on food after discount", () => {
    const tax = { enabled: true, rateBps: 500, inclusive: false };
    const q = computeQuote(lines, { ...base, tax }, "pickup", 4000);
    expect(q.taxPaise).toBe(5000); // 5 percent of 1000.00
    expect(q.totalPaise).toBe(105000);
  });

  it("extracts inclusive GST without changing the total", () => {
    const tax = { enabled: true, rateBps: 500, inclusive: true };
    const q = computeQuote([{ unitPricePaise: 10500, addOnPricesPaise: [], quantity: 1 }], { ...base, tax }, "pickup");
    expect(q.taxPaise).toBe(500);
    expect(q.totalPaise).toBe(10500);
  });

  it("caps discount at the subtotal", () => {
    expect(computeQuote(lines, base, "pickup", 999999).totalPaise).toBe(0);
  });

  it("flags orders below the minimum", () => {
    const q = computeQuote([{ unitPricePaise: 3000, addOnPricesPaise: [], quantity: 1 }], base, "pickup");
    expect(q.belowMinimum).toBe(true);
  });

  it("rejects empty carts and bad quantities", () => {
    expect(() => computeQuote([], base, "pickup")).toThrow();
    expect(() => computeQuote([{ unitPricePaise: 1, addOnPricesPaise: [], quantity: 0 }], base, "pickup")).toThrow();
    expect(() => computeQuote([{ unitPricePaise: 1, addOnPricesPaise: [], quantity: 1.5 }], base, "pickup")).toThrow();
  });
});
