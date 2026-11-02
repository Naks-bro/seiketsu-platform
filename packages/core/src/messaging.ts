/**
 * Customer messaging rules: which order events notify the customer, the
 * estimated cost of each message, budgets, OTP hashing and invoice numbering.
 * Pure functions so they can be unit-tested.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { OrderStatus } from "./order-status.ts";

export type MessageChannel = "whatsapp" | "sms" | "email";
/** Meta's WhatsApp pricing categories; SMS and email use them for reporting only. */
export type MessageCategory = "authentication" | "utility" | "marketing";
export type CustomerEvent = "placed" | "ready" | "out_for_delivery" | "completed" | "cancelled" | "refunded";

export const CUSTOMER_EVENTS: CustomerEvent[] = ["placed", "ready", "out_for_delivery", "completed", "cancelled", "refunded"];

export type MessageRates = {
  sms: number;
  whatsappAuthentication: number;
  whatsappUtility: number;
  whatsappMarketing: number;
  email: number;
};

export type MessagingSettings = {
  /** Which order events send the customer a message. */
  customerUpdates: Record<CustomerEvent, boolean>;
  /** Send the same update by SMS when WhatsApp fails. */
  smsFallback: boolean;
  /** Estimated cost per message in 1/1000 paise (₹0.135 = 13500). Owner-editable. */
  rates: MessageRates;
  dailyBudgetPaise: number | null;
  monthlyBudgetPaise: number | null;
  alertEmail: string | null;
  alertWhatsapp: string | null;
};

/**
 * Rates default to the owner's MSG91 quote (₹1.48 for 5 SMS → ₹0.296 each;
 * ₹0.84 for 1 SMS + 4 WhatsApp → ₹0.136 each). Marketing uses Meta's published
 * India rate (₹0.8631) without MSG91's margin. Edit in Admin › Messaging.
 */
export const DEFAULT_MESSAGING: MessagingSettings = {
  customerUpdates: { placed: true, ready: true, out_for_delivery: true, completed: false, cancelled: true, refunded: true },
  smsFallback: true,
  rates: { sms: 29600, whatsappAuthentication: 13600, whatsappUtility: 13600, whatsappMarketing: 86310, email: 0 },
  dailyBudgetPaise: null,
  monthlyBudgetPaise: null,
  alertEmail: null,
  alertWhatsapp: null,
};

export function withMessagingDefaults(s: Partial<MessagingSettings> | null | undefined): MessagingSettings {
  return {
    ...DEFAULT_MESSAGING,
    ...s,
    customerUpdates: { ...DEFAULT_MESSAGING.customerUpdates, ...s?.customerUpdates },
    rates: { ...DEFAULT_MESSAGING.rates, ...s?.rates },
  };
}

export function messageCost(channel: MessageChannel, category: MessageCategory, rates: MessageRates): number {
  if (channel === "sms") return rates.sms;
  if (channel === "email") return rates.email;
  if (category === "authentication") return rates.whatsappAuthentication;
  if (category === "marketing") return rates.whatsappMarketing;
  return rates.whatsappUtility;
}

/** The customer update an order status change should trigger, if any. */
export function eventForStatus(status: OrderStatus, fulfilment: "pickup" | "delivery"): CustomerEvent | null {
  switch (status) {
    case "placed":
      return "placed";
    case "ready":
      // Delivery customers hear about it when the rider leaves instead.
      return fulfilment === "pickup" ? "ready" : null;
    case "out_for_delivery":
      return "out_for_delivery";
    case "completed":
      return "completed";
    case "rejected":
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

export type SpendLevel = "ok" | "warn" | "over";

/** "warn" from 80% of the budget, "over" at 100%. No budget means "ok". */
export function spendLevel(spentPaise: number, budgetPaise: number | null): SpendLevel {
  if (!budgetPaise || budgetPaise <= 0) return "ok";
  if (spentPaise >= budgetPaise) return "over";
  return spentPaise >= budgetPaise * 0.8 ? "warn" : "ok";
}

export const milliPaiseToPaise = (m: number) => Math.round(m / 1000);

// ── OTP ────────────────────────────────────────────────────────────

export const OTP_LENGTH = 6;

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/** Bound to the challenge id so a hash cannot be replayed for another challenge. */
export function hashOtp(secret: string | Uint8Array, challengeId: string, code: string): string {
  return createHmac("sha256", secret).update(`${challengeId}:${code}`).digest("hex");
}

export function otpMatches(secret: string | Uint8Array, challengeId: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(secret, challengeId, code.trim()), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 2)}XXXXXX${d.slice(-2)}` : "XXXXXXXXXX";
}

/** Normalises provider delivery-report wording to our statuses. */
export function parseDeliveryStatus(raw: unknown): "sent" | "delivered" | "read" | "failed" | null {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return null;
  if (/(fail|reject|undeliver|expired|error|blocked|dnd)/.test(s)) return "failed";
  if (/read|seen/.test(s)) return "read";
  if (/deliver/.test(s)) return "delivered";
  if (/sent|submit|accepted|queued/.test(s)) return "sent";
  return null;
}

// ── Invoice numbers ────────────────────────────────────────────────

/** Indian financial year (April–March) for a moment, in IST. e.g. "2026-27". */
export function financialYear(at: Date): string {
  const ist = new Date(at.getTime() + 330 * 60_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** GST invoice numbers must be unique per year and at most 16 characters. */
export function formatInvoiceNumber(prefix: string, fy: string, n: number): string {
  const out = `${prefix}/${fy}/${String(n).padStart(5, "0")}`;
  if (out.length > 16) throw new Error(`Invoice number too long: ${out}`);
  return out;
}