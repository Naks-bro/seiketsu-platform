import { describe, expect, it } from "vitest";
import { checkCoupon, couponDiscount, describeCoupon, normalizeCode, type CouponRule } from "./coupons.ts";
import { pointsEarned, redeemable, type LoyaltySettings } from "./loyalty.ts";

const base: CouponRule = { kind: "percent", value: 10, minSubtotalPaise: 0, maxDiscountPaise: null, startsAt: null, endsAt: null, usageLimit: null, perCustomerLimit: 1, firstOrderOnly: false, isActive: true };
const use = { now: new Date("2026-11-03T10:00:00Z"), subtotalPaise: 50000, usedTotal: 0, usedByCustomer: 0, paidOrdersByCustomer: 0 };

describe("coupons", () => {
  it("works out percent and flat discounts, capped and never above the subtotal", () => {
    expect(couponDiscount(base, 50000)).toBe(5000);
    expect(couponDiscount({ ...base, maxDiscountPaise: 3000 }, 50000)).toBe(3000);
    expect(couponDiscount({ ...base, kind: "flat", value: 80000 }, 50000)).toBe(50000);
    expect(normalizeCode(" welcome 10 ")).toBe("WELCOME10");
    expect(describeCoupon({ ...base, maxDiscountPaise: 10000, minSubtotalPaise: 40000 })).toBe("10% off (up to ₹100) on orders of ₹400+");
  });

  it("refuses coupons that are off, out of date, too small, used up or not first orders", () => {
    expect(checkCoupon(base, use)).toEqual({ ok: true, discountPaise: 5000 });
    expect(checkCoupon({ ...base, isActive: false }, use).ok).toBe(false);
    expect(checkCoupon({ ...base, endsAt: new Date("2026-11-01") }, use)).toMatchObject({ reason: "This coupon has expired." });
    expect(checkCoupon({ ...base, startsAt: new Date("2026-12-01") }, use)).toMatchObject({ reason: "This coupon is not valid yet." });
    expect(checkCoupon({ ...base, minSubtotalPaise: 60000 }, use)).toMatchObject({ reason: "This coupon needs an order of at least ₹600." });
    expect(checkCoupon({ ...base, usageLimit: 5 }, { ...use, usedTotal: 5 }).ok).toBe(false);
    expect(checkCoupon(base, { ...use, usedByCustomer: 1 })).toMatchObject({ reason: "You have already used this coupon." });
    expect(checkCoupon({ ...base, firstOrderOnly: true }, { ...use, paidOrdersByCustomer: 2 }).ok).toBe(false);
  });
});

describe("loyalty", () => {
  const s: LoyaltySettings = { enabled: true, earnPer100: 5, pointValuePaise: 100, minRedeem: 50, maxRedeemPercent: 20 };

  it("earns per full ₹100, and nothing when switched off", () => {
    expect(pointsEarned(45000, s)).toBe(20);
    expect(pointsEarned(9999, s)).toBe(0);
    expect(pointsEarned(45000, { ...s, enabled: false })).toBe(0);
  });

  it("spends points up to the owner's limit", () => {
    expect(redeemable(500, 50000, s)).toEqual({ points: 100, valuePaise: 10000 }); // 20% of ₹500
    expect(redeemable(30, 50000, s)).toEqual({ points: 0, valuePaise: 0 }); // below the minimum
    expect(redeemable(60, 50000, s)).toEqual({ points: 60, valuePaise: 6000 });
  });
});
