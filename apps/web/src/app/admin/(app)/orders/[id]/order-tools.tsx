"use client";

import { useActionState } from "react";
import { refundAction } from "../../../actions";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper">
      Print ticket
    </button>
  );
}

export function RefundForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(refundAction, undefined);
  return (
    <form action={action} className="mt-3 space-y-2 border-t border-line pt-3">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="block">
        <span className="text-sm font-medium">Refund reason</span>
        <input name="reason" required className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className="rounded-full bg-nonveg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        Refund full amount
      </button>
      {state?.error && <p role="alert" className="text-sm text-nonveg">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-veg">{state.ok}</p>}
    </form>
  );
}