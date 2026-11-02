"use client";

import { useActionState, useState } from "react";
import { STATUS_LABEL, type OrderStatus } from "@seiketsu/core/order-status";
import { changeStatusAction } from "../../actions";

type Action = { to: OrderStatus; needsReason?: boolean };

const VERB: Partial<Record<OrderStatus, string>> = {
  accepted: "Accept",
  preparing: "Start preparing",
  ready: "Mark ready",
  out_for_delivery: "Out for delivery",
  completed: "Complete",
  rejected: "Reject",
  cancelled: "Cancel order",
};

export function StatusActions({ orderId, actions, paid, compact = false }: { orderId: string; actions: Action[]; paid: boolean; compact?: boolean }) {
  const [state, formAction, pending] = useActionState(changeStatusAction, undefined);
  const [reasonFor, setReasonFor] = useState<OrderStatus | null>(null);
  const forward = actions.filter((a) => !a.needsReason);
  const stop = actions.filter((a) => a.needsReason);

  if (actions.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {forward.map((a) => (
          <form key={a.to} action={formAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="to" value={a.to} />
            <button
              type="submit"
              disabled={pending}
              className={`rounded-full bg-berry font-semibold text-cream hover:bg-berry-deep disabled:opacity-60 ${compact ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm"}`}
            >
              {VERB[a.to] ?? STATUS_LABEL[a.to]}
            </button>
          </form>
        ))}
        {!compact &&
          stop.map((a) => (
            <button
              key={a.to}
              type="button"
              onClick={() => setReasonFor(reasonFor === a.to ? null : a.to)}
              className="rounded-full border border-nonveg/40 px-5 py-2.5 text-sm font-semibold text-nonveg hover:bg-nonveg/5"
            >
              {VERB[a.to]}
            </button>
          ))}
      </div>
      {reasonFor && (
        <form action={formAction} className="space-y-2 rounded-xl border border-nonveg/30 bg-white p-3">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="to" value={reasonFor} />
          <label className="block text-sm">
            <span className="font-medium">Reason (the customer will see this)</span>
            <input name="reason" required maxLength={300} className="mt-1 w-full rounded-lg border border-line px-3 py-2" placeholder="e.g. Avocado is out of stock today" />
          </label>
          {paid && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="refund" defaultChecked className="accent-[var(--color-berry)]" />
              Refund the full payment now
            </label>
          )}
          <button type="submit" disabled={pending} className="rounded-full bg-nonveg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            Confirm {VERB[reasonFor]?.toLowerCase()}
          </button>
        </form>
      )}
      {state?.error && <p role="alert" className="text-sm text-nonveg">{state.error}</p>}
      {state?.ok && !compact && <p role="status" className="text-sm text-veg">{state.ok}</p>}
    </div>
  );
}