/** The single source of truth for which order status moves are allowed. */

export const ORDER_STATUSES = [
  "pending_payment",
  "payment_failed",
  "expired",
  "placed",
  "accepted",
  "rejected",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Actor = "system" | "staff";

export type Rule = {
  to: OrderStatus;
  by: Actor[];
  needsReason?: boolean;
  deliveryOnly?: boolean;
  pickupOnly?: boolean;
};

const RULES: Record<OrderStatus, Rule[]> = {
  pending_payment: [
    { to: "placed", by: ["system"] },
    { to: "payment_failed", by: ["system"] },
    { to: "expired", by: ["system"] },
  ],
  payment_failed: [
    { to: "pending_payment", by: ["system"] },
    { to: "placed", by: ["system"] }, // a later retry succeeded
    { to: "expired", by: ["system"] },
  ],
  expired: [{ to: "placed", by: ["system"] }], // late capture: never lose a paid order
  placed: [
    { to: "accepted", by: ["staff"] },
    { to: "rejected", by: ["staff"], needsReason: true },
  ],
  accepted: [
    { to: "preparing", by: ["staff"] },
    { to: "cancelled", by: ["staff"], needsReason: true },
  ],
  preparing: [
    { to: "ready", by: ["staff"] },
    { to: "cancelled", by: ["staff"], needsReason: true },
  ],
  ready: [
    { to: "out_for_delivery", by: ["staff"], deliveryOnly: true },
    { to: "completed", by: ["staff"], pickupOnly: true },
  ],
  out_for_delivery: [{ to: "completed", by: ["staff"] }],
  rejected: [],
  completed: [],
  cancelled: [],
};

export type TransitionCheck = { ok: true } | { ok: false; error: string };

export function checkTransition(args: {
  from: OrderStatus;
  to: OrderStatus;
  actor: Actor;
  fulfilment: "pickup" | "delivery";
  reason?: string | null;
}): TransitionCheck {
  const rule = RULES[args.from].find((r) => r.to === args.to);
  if (!rule) return { ok: false, error: `Cannot move an order from ${args.from} to ${args.to}.` };
  if (!rule.by.includes(args.actor)) return { ok: false, error: `Only ${rule.by.join("/")} can do that.` };
  if (rule.deliveryOnly && args.fulfilment !== "delivery") {
    return { ok: false, error: "Only delivery orders go out for delivery." };
  }
  if (rule.pickupOnly && args.fulfilment !== "pickup") {
    return { ok: false, error: "Delivery orders must go out for delivery first." };
  }
  if (rule.needsReason && !args.reason?.trim()) return { ok: false, error: "A reason is required." };
  return { ok: true };
}

/** Next actions staff can take from a status, for building buttons. */
export function staffActions(from: OrderStatus, fulfilment: "pickup" | "delivery"): Rule[] {
  return RULES[from].filter(
    (r) =>
      r.by.includes("staff") &&
      !(r.deliveryOnly && fulfilment !== "delivery") &&
      !(r.pickupOnly && fulfilment !== "pickup"),
  );
}

/** Statuses after payment that the kitchen/admin works on. */
export const ACTIVE_STATUSES: OrderStatus[] = ["placed", "accepted", "preparing", "ready", "out_for_delivery"];

/** Paid orders that end without being served need a refund. */
export const REFUND_ON: OrderStatus[] = ["rejected", "cancelled"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  payment_failed: "Payment failed",
  expired: "Expired",
  placed: "Order received",
  accepted: "Accepted",
  rejected: "Rejected",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};
