/** Coupon rules. The server checks every coupon at checkout; the browser only previews. */

export type CouponRule = {
  kind: "percent" | "flat";
  /** percent: 1–100; flat: paise */
  value: number;
  minSubtotalPaise: number;
  maxDiscountPaise: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  firstOrderOnly: boolean;
  isActive: boolean;
};

export type CouponUse = { now: Date; subtotalPaise: number; usedTotal: number; usedByCustomer: number; paidOrdersByCustomer: number };

export const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
export const COUPON_CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,19}$/;

export function couponDiscount(c: Pick<CouponRule, "kind" | "value" | "maxDiscountPaise">, subtotalPaise: number) {
  const raw = c.kind === "percent" ? Math.floor((subtotalPaise * Math.min(100, Math.max(0, c.value))) / 100) : c.value;
  const capped = c.maxDiscountPaise != null ? Math.min(raw, c.maxDiscountPaise) : raw;
  return Math.max(0, Math.min(capped, subtotalPaise));
}

export function checkCoupon(c: CouponRule, u: CouponUse): { ok: true; discountPaise: number } | { ok: false; reason: string } {
  const no = (reason: string) => ({ ok: false as const, reason });
  if (!c.isActive) return no("This coupon is not active.");
  if (c.startsAt && u.now < c.startsAt) return no("This coupon is not valid yet.");
  if (c.endsAt && u.now > c.endsAt) return no("This coupon has expired.");
  if (u.subtotalPaise < c.minSubtotalPaise) return no(`This coupon needs an order of at least ₹${Math.ceil(c.minSubtotalPaise / 100)}.`);
  if (c.usageLimit != null && u.usedTotal >= c.usageLimit) return no("This coupon has been fully used.");
  if (c.perCustomerLimit != null && u.usedByCustomer >= c.perCustomerLimit) return no("You have already used this coupon.");
  if (c.firstOrderOnly && u.paidOrdersByCustomer > 0) return no("This coupon is for first orders only.");
  const discountPaise = couponDiscount(c, u.subtotalPaise);
  if (discountPaise <= 0) return no("This coupon doesn’t apply to this order.");
  return { ok: true, discountPaise };
}

export function describeCoupon(c: Pick<CouponRule, "kind" | "value" | "maxDiscountPaise" | "minSubtotalPaise">) {
  const off = c.kind === "percent" ? `${c.value}% off` : `₹${c.value / 100} off`;
  const cap = c.kind === "percent" && c.maxDiscountPaise != null ? ` (up to ₹${c.maxDiscountPaise / 100})` : "";
  const min = c.minSubtotalPaise > 0 ? ` on orders of ₹${c.minSubtotalPaise / 100}+` : "";
  return off + cap + min;
}
