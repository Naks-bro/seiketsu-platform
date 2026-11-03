/** "What are you interested in?" on the plans enquiry form, in the owner's wording. */
export const ENQUIRY_INTERESTS = [
  { key: "subscriptions", label: "Subscription Plans" },
  { key: "individual", label: "Individual Orders" },
  { key: "corporate", label: "Corporate / Bulk Orders" },
  { key: "catering", label: "Catering & Events" },
  { key: "partnership", label: "Business Partnerships" },
  { key: "general", label: "General Enquiry" },
] as const;

export type EnquiryInterest = (typeof ENQUIRY_INTERESTS)[number]["key"];
export const ENQUIRY_KEYS = ENQUIRY_INTERESTS.map((i) => i.key) as [EnquiryInterest, ...EnquiryInterest[]];
export const interestLabel = (key: string) => ENQUIRY_INTERESTS.find((i) => i.key === key)?.label ?? key;
