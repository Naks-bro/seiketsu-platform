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
  /**
   * FSSAI registration (not a licence), shown on the site and on every bill as the FSS Act requires.
   * Registration 21526006002945, Greater Mumbai, fee paid up to 15-09-2027: renew on foscos.fssai.gov.in before then.
   */
  fssai: process.env.FSSAI_NUMBER?.trim() || "21526006002945",
  fssaiLabel: "FSSAI Reg. No.",
  /** Date the policy text was last reviewed by the owner (YYYY-MM-DD). */
  lastUpdated: "2026-11-02",
};

export function businessLabel(storeName: string) {
  return LEGAL.businessName ? `${LEGAL.businessName} (${storeName})` : storeName;
}
