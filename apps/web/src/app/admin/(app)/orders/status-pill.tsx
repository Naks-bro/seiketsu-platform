import { STATUS_LABEL, type OrderStatus } from "@seiketsu/core/order-status";

const TONE: Record<OrderStatus, string> = {
  pending_payment: "bg-paper text-muted",
  payment_failed: "bg-paper text-nonveg",
  expired: "bg-paper text-muted",
  placed: "bg-orange/15 text-[#9a4d0b] ring-1 ring-orange/40",
  accepted: "bg-butter text-ink",
  preparing: "bg-pink/15 text-berry",
  ready: "bg-veg/15 text-veg",
  out_for_delivery: "bg-olive/20 text-olive-ink",
  completed: "bg-paper text-ink",
  rejected: "bg-nonveg/10 text-nonveg",
  cancelled: "bg-nonveg/10 text-nonveg",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}