"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatINR } from "@/lib/format";
import { usePayment, type PaymentParams } from "./use-payment";

const ENDPOINTS = { verify: "/api/subscriptions/verify", failed: "/api/subscriptions/failed" };

/** Pay for a subscription (first payment or a renewal) through Razorpay Checkout. The server decides what is paid. */
export function SubscriptionPay({ token, planName, amountPaise, kind }: { token: string; planName: string; amountPaise: number; kind: "first" | "renewal" }) {
  const router = useRouter();
  const { start, dialog } = usePayment(`${planName}${kind === "renewal" ? " · renewal" : ""}`, ENDPOINTS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function pay() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/subscriptions/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = (await res.json()) as PaymentParams & { error?: string };
      if (!res.ok) return setMsg({ tone: "bad", text: data.error ?? "We could not start the payment. Please try again." });
      const outcome = await start(data, token);
      if (outcome === "paid") {
        setMsg({ tone: "ok", text: kind === "renewal" ? "Renewed. Thank you! Your new meals are added below." : "Payment received. Thank you! Your plan is confirmed." });
        router.refresh();
      } else if (outcome === "pending") {
        setMsg({ tone: "ok", text: "We’re confirming your payment with the bank. This page updates in a few minutes." });
      } else if (outcome === "error") {
        setMsg({ tone: "bad", text: "We couldn’t confirm the payment here. If money left your account, it is matched automatically within a few minutes." });
      }
    } catch {
      setMsg({ tone: "bad", text: "Something went wrong. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="flex w-full items-center justify-between rounded-full bg-berry px-6 py-3.5 font-semibold text-cream shadow-[var(--shadow-float)] hover:bg-berry-deep disabled:opacity-60 sm:w-auto sm:min-w-80"
      >
        <span>{busy ? "Opening payment…" : kind === "renewal" ? "Renew for another cycle" : "Pay now"}</span>
        <span className="tabular">{formatINR(amountPaise)}</span>
      </button>
      {msg && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${msg.tone === "ok" ? "bg-veg/10 text-veg" : "bg-nonveg/10 text-nonveg"}`}>
          {msg.text}
        </p>
      )}
      {dialog}
    </div>
  );
}
