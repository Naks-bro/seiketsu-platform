import { describe, expect, it } from "vitest";
import { canRenew, counterKey, creditFor, istMonth, istMonthRange, priceWithTax, renewCycle } from "./invoices.ts";

const off = { enabled: false, rateBps: 500, inclusive: true };

describe("priceWithTax", () => {
  it("leaves the price alone when tax is off", () => {
    expect(priceWithTax(450000, off)).toEqual({ taxablePaise: 450000, taxPaise: 0, totalPaise: 450000 });
  });
  it("splits an inclusive price without changing what the customer pays", () => {
    const r = priceWithTax(105000, { enabled: true, rateBps: 500, inclusive: true });
    expect(r).toEqual({ taxablePaise: 100000, taxPaise: 5000, totalPaise: 105000 });
  });
  it("adds tax on top when prices exclude it", () => {
    expect(priceWithTax(100000, { enabled: true, rateBps: 500, inclusive: false })).toEqual({ taxablePaise: 100000, taxPaise: 5000, totalPaise: 105000 });
  });
  it("rejects fractional paise", () => {
    expect(() => priceWithTax(10.5, off)).toThrow();
  });
});

describe("creditFor", () => {
  it("keeps the invoice's tax proportion on a partial refund", () => {
    expect(creditFor(52500, { taxablePaise: 100000, taxPaise: 5000, totalPaise: 105000 })).toEqual({ taxablePaise: 50000, taxPaise: 2500, totalPaise: 52500 });
  });
  it("never credits more than was invoiced", () => {
    expect(() => creditFor(200, { taxablePaise: 100, taxPaise: 0, totalPaise: 100 })).toThrow();
  });
});

describe("renewCycle", () => {
  const plan = { mealsTotal: 20, durationDays: 28 };
  it("adds the meals and runs on from the current end date", () => {
    expect(renewCycle({ startDate: "2026-11-01", endDate: "2026-11-28", status: "active", mealsTotal: 20 }, plan, "2026-11-20")).toEqual({
      mealsTotal: 40,
      endDate: "2026-12-26",
      status: "active",
    });
  });
  it("starts from today when the plan already ended, and reopens it", () => {
    expect(renewCycle({ startDate: "2026-10-01", endDate: "2026-10-28", status: "completed", mealsTotal: 20 }, plan, "2026-11-09")).toEqual({
      mealsTotal: 40,
      endDate: "2026-12-06",
      status: "active",
    });
  });
});

describe("helpers", () => {
  it("keeps the main series counter key unchanged and separates credit notes", () => {
    expect(counterKey("SK", "2026-27")).toBe("2026-27");
    expect(counterKey("CN", "2026-27")).toBe("CN:2026-27");
  });
  it("offers renewal only for paid, running or finished plans", () => {
    expect(canRenew("active", true)).toBe(true);
    expect(canRenew("completed", true)).toBe(true);
    expect(canRenew("pending", false)).toBe(false);
    expect(canRenew("cancelled", true)).toBe(false);
  });
});

describe("istMonthRange", () => {
  it("covers the India-time month", () => {
    const { from, to } = istMonthRange("2026-11");
    expect(from.toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(to.toISOString()).toBe("2026-11-30T18:30:00.000Z");
    expect(istMonth(new Date("2026-10-31T19:00:00Z"))).toBe("2026-11");
  });
  it("rejects a bad month", () => {
    expect(() => istMonthRange("2026-13")).toThrow();
  });
});
