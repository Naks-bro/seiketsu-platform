"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatINR } from "@/lib/format";
import { useLive } from "@/lib/live";
import { useCart } from "@/lib/cart";
import { usePayment, type PaymentParams } from "./use-payment";

const FINAL = new Set(["completed", "rejected", "cancelled", "expired"]);

/** Refreshes the page when the order status changes. */
export function LiveRefresh({ token, status }: { token: string; status: string }) {
  const router = useRouter();
  useLive(FINAL.has(status) ? null : `order-${token}`, async () => {
    const r = await fetch(`/api/orders/${token}`, { cache: "no-store" });
    if (!r.ok) return;
    const data = (await r.json()) as { status: string };
    if (data.status !== status) router.refresh();
  });
  return null;
}

export function PayNow({ token, orderNumber, totalPaise }: { token: string; orderNumber: string; totalPaise: number }) {
  const router = useRouter();
  const { clear } = useCart();
  const { start, dialog } = usePayment(orderNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/orders/${token}/pay`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Could not start payment.");
        return;
      }
      const outcome = await start(data as PaymentParams, token);
      if (outcome === "paid" || outcome === "pending") clear();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={pay} disabled={busy} className="rounded-full bg-berry px-6 py-3 font-semibold text-cream hover:bg-berry-deep disabled:opacity-60">
        {busy ? "Opening payment…" : `Pay ${formatINR(totalPaise)} now`}
      </button>
      {error && <p role="alert" className="text-sm text-nonveg">{error}</p>}
      {dialog}
    </>
  );
}