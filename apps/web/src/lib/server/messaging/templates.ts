import "server-only";
import type { MessageCategory } from "@seiketsu/core/messaging";

/**
 * Every message the platform sends. WhatsApp templates are approved in WhatsApp Manager with variables in exactly
 * this order, named seiketsu_<kind> (or WHATSAPP_TPL_<KIND>). See docs/whatsapp-templates.md.
 */
export type TemplateKind =
  | "otp"
  | "order_placed"
  | "order_ready"
  | "order_out_for_delivery"
  | "order_completed"
  | "order_cancelled"
  | "order_refunded"
  | "staff_alert";

type Template = {
  category: MessageCategory;
  /** variable names, in template order ({{1}}, {{2}} ... / ##var1## ...) */
  vars: string[];
  /** plain-text version used for logs, email and dev mode */
  text: (v: Record<string, string>) => string;
  /** SMS fallback allowed for this kind */
  sms: boolean;
  /** stored vars would leak a secret (OTP) */
  secret?: boolean;
};

export const TEMPLATES: Record<TemplateKind, Template> = {
  otp: {
    category: "authentication",
    vars: ["code"],
    text: (v) => `${v.code} is your Seiketsu login code. It expires in 10 minutes. Do not share it.`,
    sms: true,
    secret: true,
  },
  order_placed: {
    category: "utility",
    vars: ["name", "order", "total", "link"],
    text: (v) => `Hi ${v.name}, your Seiketsu order ${v.order} for ${v.total} is confirmed. Track it and get your bill: ${v.link}`,
    sms: true,
  },
  order_ready: {
    category: "utility",
    vars: ["name", "order"],
    text: (v) => `Hi ${v.name}, your Seiketsu order ${v.order} is ready for pickup.`,
    sms: true,
  },
  order_out_for_delivery: {
    category: "utility",
    vars: ["name", "order"],
    text: (v) => `Hi ${v.name}, your Seiketsu order ${v.order} is out for delivery.`,
    sms: true,
  },
  order_completed: {
    category: "utility",
    vars: ["name", "order"],
    text: (v) => `Thank you ${v.name}! Your Seiketsu order ${v.order} is complete. Enjoy your meal.`,
    sms: false,
  },
  order_cancelled: {
    category: "utility",
    vars: ["name", "order", "reason"],
    text: (v) => `Hi ${v.name}, sorry, your Seiketsu order ${v.order} was cancelled (${v.reason}). Your payment will be refunded in full.`,
    sms: true,
  },
  order_refunded: {
    category: "utility",
    vars: ["name", "order", "amount"],
    text: (v) => `Hi ${v.name}, a refund of ${v.amount} for Seiketsu order ${v.order} has been started. It usually reaches you in 5-7 working days.`,
    sms: true,
  },
  staff_alert: {
    category: "utility",
    vars: ["message"],
    text: (v) => `Seiketsu alert: ${v.message}`,
    sms: false,
  },
};