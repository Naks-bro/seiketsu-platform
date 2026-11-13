/**
 * WhatsApp replies that cost nothing. Meta charges for messages a business starts, but replies sent within
 * 24 hours of the customer's last message are free. Everything here is sent only inside that window.
 * Formatting is WhatsApp's own: *bold*, _italic_.
 */
import { findLoginCode } from "./whatsapp-login";

/** A little under Meta's 24 hours, so a reply never lands just after the window shuts. */
export const SERVICE_WINDOW_MS = 23.5 * 60 * 60 * 1000;

export type InboundIntent = { kind: "login" } | { kind: "track"; orderNumber: string } | { kind: "hello" };

const ORDER_RE = /\bSK-?(\d{3,7})\b/i;

export function intentOf(text: string): InboundIntent {
  if (/login/i.test(text) && findLoginCode(text)) return { kind: "login" };
  const m = ORDER_RE.exec(text);
  if (m) return { kind: "track", orderNumber: `SK-${m[1]}` };
  return { kind: "hello" };
}

type Msg = { from?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string } } };
type Payload = { entry?: { changes?: { value?: { messages?: Msg[] } }[] }[] };

/** Every customer message in one webhook delivery (any type), with its text when it has one. */
export function incomingMessages(payload: Payload): { from: string; text: string }[] {
  const out: { from: string; text: string }[] = [];
  for (const e of payload.entry ?? [])
    for (const c of e.changes ?? [])
      for (const m of c.value?.messages ?? []) {
        if (!m.from) continue;
        out.push({ from: m.from, text: m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? "" });
      }
  return out;
}

export type ReplyContext = { siteUrl: string; mapUrl?: string | null; helpNumber?: string | null };

const help = (c: ReplyContext) => (c.helpNumber ? `\n\nNeed a person? Message us at wa.me/${c.helpNumber}` : "");

export function welcomeText(c: ReplyContext): string {
  return [
    "*Welcome to Seiketsu* 🌿",
    "_The art of clean eating · Versova, Mumbai_",
    "",
    "🥗 *See the menu & order*",
    `${c.siteUrl}/menu`,
    "",
    "📦 *Track an order*",
    "Reply with your order number, like _SK-1006_",
    ...(c.mapUrl ? ["", "📍 *Find us*", c.mapUrl] : []),
  ].join("\n") + help(c);
}

export const signedInText = () =>
  ["✅ *Got it, you're verified*", "", "Go back to the Seiketsu page you started from. It signs you in on its own.", "", "_Didn't try to sign in? You can ignore this message._"].join("\n");

export function trackText(o: { orderNumber: string; statusLabel: string; link: string }): string {
  return [`📦 *Order ${o.orderNumber}*`, "", `Status: *${o.statusLabel}*`, "", "We'll message you here as it moves along.", `Live status & bill: ${o.link}`].join("\n");
}

export const orderNotFoundText = (orderNumber: string, c: ReplyContext) =>
  `We couldn't find order *${orderNumber}* for this WhatsApp number. Please check the number on your order page, or message us from the phone number you ordered with.${help(c)}`;

/** Order updates, keyed by message kind. Variables as in the web app's TEMPLATES. */
const ORDER_TEXTS: Record<string, (v: Record<string, string>) => string> = {
  order_placed: (v) =>
    [`✅ *Order confirmed*`, "", `Hi ${v.name}, we've got your order *${v.order}* (${v.total}). The kitchen is on it.`, "", "We'll message you here when it's ready.", `Track & bill: ${v.link}`].join("\n"),
  order_ready: (v) =>
    [`🥗 *Your order is ready*`, "", `${v.name}, *${v.order}* is packed and waiting for you at Seiketsu Versova. Show this order number at the counter.`, "", `Order: ${v.link}`].join("\n"),
  order_out_for_delivery: (v) =>
    [`🛵 *On its way*`, "", `${v.name}, your order *${v.order}* is out for delivery and will be with you soon.`, "", `Track: ${v.link}`].join("\n"),
  order_completed: (v) =>
    [`🌿 *Enjoy your meal, ${v.name}!*`, "", `Thank you for eating clean with us. Your bill for *${v.order}* is here:`, v.link].join("\n"),
  order_cancelled: (v) =>
    [`*Order ${v.order} cancelled*`, "", `Sorry ${v.name}, we had to cancel this order (${v.reason}). If you paid, the full amount is refunded automatically.`, "", `Details: ${v.link}`].join("\n"),
  order_refunded: (v) =>
    [`💸 *Refund started*`, "", `${v.name}, we've refunded ${v.amount} for order *${v.order}*. It usually reaches your account in 5–7 working days.`].join("\n"),
};

/** The free-reply version of an order update, or null for kinds that have none. */
export function orderUpdateText(kind: string, vars: Record<string, string>): string | null {
  return ORDER_TEXTS[kind]?.(vars) ?? null;
}
