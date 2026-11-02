"use client";

import { useCallback, useState } from "react";

export type PaymentParams = {
  mode: "razorpay" | "simulator";
  keyId: string | null;
  razorpayOrderId: string;
  amountPaise: number;
  prefill: { name: string; contact: string; email?: string };
};

export type PaymentOutcome = "paid" | "pending" | "dismissed" | "error";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayFailure = { error: { code?: string; description?: string; metadata?: { order_id?: string } } };
type RazorpayInstance = { open(): void; on(event: "payment.failed", cb: (r: RazorpayFailure) => void): void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay. Check your connection and try again."));
    document.body.appendChild(s);
  });
}

async function verify(token: string, r: RazorpayResponse): Promise<PaymentOutcome> {
  const res = await fetch("/api/payments/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...r }),
  });
  if (!res.ok) return "error";
  const { status } = (await res.json()) as { status: string };
  return status === "placed" || status === "accepted" ? "paid" : "pending";
}

/**
 * Opens Razorpay Checkout (or the local simulator) and resolves once the
 * customer pays or closes it. The server decides whether the order is paid.
 */
export function usePayment(orderNumber: string) {
  const [simulator, setSimulator] = useState<{ params: PaymentParams; token: string; resolve: (o: PaymentOutcome) => void } | null>(null);

  const start = useCallback(
    async (params: PaymentParams, token: string): Promise<PaymentOutcome> => {
      if (params.mode === "simulator") {
        return new Promise((resolve) => setSimulator({ params, token, resolve }));
      }
      await loadCheckoutScript();
      return new Promise((resolve) => {
        const rzp = new window.Razorpay!({
          key: params.keyId,
          order_id: params.razorpayOrderId,
          amount: params.amountPaise,
          currency: "INR",
          name: "Seiketsu",
          description: `Order ${orderNumber}`,
          prefill: params.prefill,
          theme: { color: "#a51c47" },
          handler: (r: RazorpayResponse) => verify(token, r).then(resolve, () => resolve("error")),
          modal: { ondismiss: () => resolve("dismissed"), confirm_close: true },
        });
        rzp.on("payment.failed", (f) => {
          // Razorpay lets the customer retry inside the modal, so only record it.
          fetch("/api/payments/failed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token,
              razorpay_order_id: f.error.metadata?.order_id ?? params.razorpayOrderId,
              code: f.error.code,
              description: f.error.description,
            }),
          }).catch(() => {});
        });
        rzp.open();
      });
    },
    [orderNumber],
  );

  async function simulate(outcome: "success" | "failure" | "close") {
    if (!simulator) return;
    const { params, token, resolve } = simulator;
    setSimulator(null);
    if (outcome === "close") return resolve("dismissed");
    if (outcome === "failure") {
      await fetch("/api/payments/failed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, razorpay_order_id: params.razorpayOrderId, code: "SIMULATED", description: "Simulated failure" }),
      });
      return resolve("dismissed");
    }
    const r = await fetch("/api/dev/simulate-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razorpay_order_id: params.razorpayOrderId }),
    });
    if (!r.ok) return resolve("error");
    resolve(await verify(token, await r.json()));
  }

  const dialog = simulator ? (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="sim-title" className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange">Local test mode</p>
        <h2 id="sim-title" className="font-display text-2xl">Payment simulator</h2>
        <p className="text-sm text-muted">
          Razorpay keys are not set, so this stands in for Razorpay Checkout. It only works on a developer machine.
        </p>
        <p className="tabular text-lg font-semibold">₹{(simulator.params.amountPaise / 100).toFixed(2)}</p>
        <div className="grid gap-2">
          <button type="button" onClick={() => simulate("success")} className="rounded-full bg-veg px-4 py-2.5 font-semibold text-white">
            Pay successfully
          </button>
          <button type="button" onClick={() => simulate("failure")} className="rounded-full bg-nonveg px-4 py-2.5 font-semibold text-white">
            Fail the payment
          </button>
          <button type="button" onClick={() => simulate("close")} className="rounded-full border border-line px-4 py-2.5 font-semibold">
            Close without paying
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { start, dialog };
}