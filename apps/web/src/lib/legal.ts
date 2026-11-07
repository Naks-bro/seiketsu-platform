/**
 * Business details shown on the policy pages. Razorpay checks these before
 * enabling live payments. Fields left null are not shown; the owner must fill
 * them in before go-live (see README "Policy pages").
 */
export const LEGAL = {
  /** Registered business / legal entity name, as on the Razorpay account. */
  businessName: process.env.LEGAL_BUSINESS_NAME?.trim() || null,
  /** Public support email for orders, refunds and privacy requests. */
  supportEmail: process.env.SUPPORT_EMAIL?.trim() || null,
  /** Date the policy text was last reviewed by the owner (YYYY-MM-DD). */
  lastUpdated: "2026-11-02",
};

export function businessLabel(storeName: string) {
  return LEGAL.businessName ? `${LEGAL.businessName} (${storeName})` : storeName;
}
