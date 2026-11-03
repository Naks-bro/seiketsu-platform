/** Loyalty points. Everything is set by the owner in Settings and is off until switched on. */

export type LoyaltySettings = {
  enabled: boolean;
  /** points earned for every full ₹100 paid for food */
  earnPer100: number;
  /** what one point is worth when spent, in paise */
  pointValuePaise: number;
  /** smallest balance that can be spent */
  minRedeem: number;
  /** the most of an order (after coupons) that points may pay for, in percent */
  maxRedeemPercent: number;
};

export const LOYALTY_OFF: LoyaltySettings = { enabled: false, earnPer100: 0, pointValuePaise: 0, minRedeem: 0, maxRedeemPercent: 0 };

export function pointsEarned(foodPaidPaise: number, s: LoyaltySettings) {
  if (!s.enabled || s.earnPer100 <= 0 || foodPaidPaise <= 0) return 0;
  return Math.floor(foodPaidPaise / 10000) * s.earnPer100;
}

/** How many points can go towards an order, and what they take off. */
export function redeemable(balance: number, payablePaise: number, s: LoyaltySettings) {
  const none = { points: 0, valuePaise: 0 };
  if (!s.enabled || s.pointValuePaise <= 0 || s.maxRedeemPercent <= 0 || balance <= 0 || balance < s.minRedeem) return none;
  const cap = Math.floor((payablePaise * Math.min(100, s.maxRedeemPercent)) / 100);
  const points = Math.min(balance, Math.floor(cap / s.pointValuePaise));
  return points > 0 ? { points, valuePaise: points * s.pointValuePaise } : none;
}
