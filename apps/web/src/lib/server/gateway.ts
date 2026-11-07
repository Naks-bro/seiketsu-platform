import "server-only";
import { randomBytes } from "node:crypto";
import Razorpay from "razorpay";
import { env } from "./env";

export type GatewayPayment = {
  id: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amountPaise: number;
  method: string | null;
  orderId: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
  /** Razorpay fee and GST on it; present once captured */
  feePaise?: number | null;
  feeTaxPaise?: number | null;
};

export interface PaymentGateway {
  createOrder(args: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<{ id: string }>;
  fetchPayment(paymentId: string): Promise<GatewayPayment | null>;
  capture(paymentId: string, amountPaise: number): Promise<GatewayPayment>;
  orderPayments(razorpayOrderId: string): Promise<GatewayPayment[]>;
  refund(paymentId: string, amountPaise: number, notes: Record<string, string>): Promise<{ id: string; status: string }>;
  paymentRefunds(paymentId: string): Promise<{ id: string; status: string; intentId: string | null; amountPaise: number }[]>;
}

type RzpPayment = {
  id: string;
  status: GatewayPayment["status"];
  amount: number | string;
  method?: string;
  order_id?: string;
  error_code?: string | null;
  error_description?: string | null;
  fee?: number | string | null;
  tax?: number | string | null;
};

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));

const toPayment = (p: RzpPayment): GatewayPayment => ({
  id: p.id,
  status: p.status,
  amountPaise: Number(p.amount),
  method: p.method ?? null,
  orderId: p.order_id ?? null,
  errorCode: p.error_code ?? null,
  errorDescription: p.error_description ?? null,
  feePaise: num(p.fee),
  feeTaxPaise: num(p.tax),
});

/** An ambiguous write timeout is handled by the persisted intent, never by blindly retrying. */
function bounded<T>(work: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Payment provider timed out")), 10_000);
    work.then((result) => { clearTimeout(timer); resolve(result); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

function razorpayGateway(): PaymentGateway {
  const rzp = new Razorpay({ key_id: env.razorpay.keyId!, key_secret: env.razorpay.keySecret! });
  return {
    async createOrder({ amountPaise, receipt, notes }) {
      const o = await bounded(rzp.orders.create({ amount: amountPaise, currency: "INR", receipt, notes }));
      return { id: o.id };
    },
    async fetchPayment(id) {
      try {
        return toPayment((await bounded(rzp.payments.fetch(id))) as unknown as RzpPayment);
      } catch {
        return null;
      }
    },
    async capture(id, amountPaise) {
      return toPayment((await bounded(rzp.payments.capture(id, amountPaise, "INR"))) as unknown as RzpPayment);
    },
    async orderPayments(orderId) {
      const r = (await bounded(rzp.orders.fetchPayments(orderId))) as unknown as { items: RzpPayment[] };
      return r.items.map(toPayment);
    },
    async refund(paymentId, amountPaise, notes) {
      const r = await bounded(rzp.payments.refund(paymentId, { amount: amountPaise, notes, receipt: notes.refund_intent }));
      return { id: r.id, status: String(r.status) };
    },
    async paymentRefunds(paymentId) {
      const items = [];
      for (let skip = 0; ; skip += 100) {
        const page = await bounded(rzp.payments.fetchMultipleRefund(paymentId, { count: 100, skip }));
        items.push(...page.items.map((r) => ({ id: r.id, status: String(r.status), intentId: String(r.notes?.refund_intent ?? r.receipt ?? "") || null, amountPaise: Number(r.amount) })));
        if (page.items.length < 100) return items;
      }
    },
  };
}

/** Local-only stand-in used with PAYMENTS_MODE=simulator. Never active in production. */
function simulatorGateway(): PaymentGateway {
  const rid = (p: string) => `${p}_sim_${randomBytes(7).toString("hex")}`;
  return {
    async createOrder() {
      return { id: rid("order") };
    },
    async fetchPayment() {
      return null;
    },
    async capture(id, amountPaise) {
      return { id, status: "captured", amountPaise, method: "simulator", orderId: null };
    },
    async orderPayments() {
      return [];
    },
    async refund() {
      return { id: rid("rfnd"), status: "processed" };
    },
    async paymentRefunds() { return []; },
  };
}

let cached: PaymentGateway | null = null;
export function gateway(): PaymentGateway {
  if (env.paymentsMode === "disabled") throw new Error("Online payments are not configured.");
  cached ??= env.paymentsMode === "razorpay" ? razorpayGateway() : simulatorGateway();
  return cached;
}

export function newSimulatorPaymentId() {
  return `pay_sim_${randomBytes(7).toString("hex")}`;
}
