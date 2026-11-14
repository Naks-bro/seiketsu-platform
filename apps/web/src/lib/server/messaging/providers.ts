import "server-only";
import { randomBytes } from "node:crypto";
import { maskPhone } from "@seiketsu/core/messaging";
import { env } from "../env";
import { TEMPLATES, type TemplateKind } from "./templates";

export type Channel = "whatsapp" | "sms" | "email";
export type SendResult = { providerMessageId: string | null };
export class NotConfigured extends Error {}

const intl = (phone: string) => `91${phone.replace(/\D/g, "").slice(-10)}`;

/** Is this channel able to send this kind right now? */
export function channelReady(channel: Channel): boolean {
  const m = env.messaging;
  if (m.mode === "disabled") return false;
  if (m.mode === "log") return true;
  if (channel === "email") return !!m.resendApiKey && !!m.emailFrom;
  // WhatsApp goes through Meta only. There is no SMS provider.
  return channel === "whatsapp" && !!m.meta;
}

export function providerName(channel: Channel) {
  if (env.messaging.mode === "log") return "log";
  if (channel === "email") return "resend";
  return channel === "whatsapp" ? "meta" : "none";
}

async function postJson(url: string, body: unknown, headers: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok || json.hasError === true || json.type === "error" || json.status === "fail") {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

/** WhatsApp Cloud API (Meta): one approved template message. Returns Meta's message id (wamid). */
async function metaWhatsApp(to: string, kind: TemplateKind, vars: Record<string, string>): Promise<SendResult> {
  const meta = env.messaging.meta;
  if (!meta) throw new NotConfigured("WhatsApp Cloud API not configured");
  const t = TEMPLATES[kind];
  const components: Record<string, unknown>[] = [
    { type: "body", parameters: t.vars.map((k) => ({ type: "text", text: vars[k] ?? "" })) },
  ];
  // Authentication templates repeat the code on their copy-code button.
  if (t.category === "authentication") components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: vars.code }] });
  const json = await postJson(
    `https://graph.facebook.com/v23.0/${meta.phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to: intl(to),
      type: "template",
      template: { name: meta.template(kind), language: { code: meta.language }, components },
    },
    { Authorization: `Bearer ${meta.accessToken}` },
  );
  const messages = json.messages as { id?: string }[] | undefined;
  return { providerMessageId: messages?.[0]?.id ?? null };
}

/** A plain WhatsApp text (Meta). Free only as a reply within 24 hours of the customer's last message; callers check. */
export async function metaWhatsAppText(to: string, body: string): Promise<SendResult> {
  const meta = env.messaging.meta;
  if (!meta) throw new NotConfigured("WhatsApp Cloud API not configured");
  const json = await postJson(
    `https://graph.facebook.com/v23.0/${meta.phoneNumberId}/messages`,
    { messaging_product: "whatsapp", recipient_type: "individual", to: intl(to), type: "text", text: { preview_url: true, body } },
    { Authorization: `Bearer ${meta.accessToken}` },
  );
  const messages = json.messages as { id?: string }[] | undefined;
  return { providerMessageId: messages?.[0]?.id ?? null };
}

async function resendEmail(to: string, subject: string, text: string, html?: string): Promise<SendResult> {
  const { resendApiKey, emailFrom } = env.messaging;
  if (!resendApiKey || !emailFrom) throw new NotConfigured("Email not configured");
  const json = await postJson(
    "https://api.resend.com/emails",
    { from: emailFrom, to: [to], subject, text, ...(html ? { html } : {}) },
    { Authorization: `Bearer ${resendApiKey}` },
  );
  return { providerMessageId: String(json.id ?? "") || null };
}

export async function deliver(args: {
  channel: Channel;
  kind: TemplateKind;
  to: string;
  vars: Record<string, string>;
  email?: { subject: string; html?: string };
}): Promise<SendResult> {
  const { channel, kind, to, vars } = args;
  if (env.messaging.mode === "disabled") throw new NotConfigured("Messaging is disabled");
  if (env.messaging.mode === "log") {
    const who = channel === "email" ? to : maskPhone(to);
    // Dev only: the full text (including OTP codes) is printed so you can log in locally.
    console.info(`[message:${channel}] ${kind} → ${who}: ${TEMPLATES[kind].text(vars)}`);
    return { providerMessageId: `log_${randomBytes(6).toString("hex")}` };
  }
  if (channel === "whatsapp") return metaWhatsApp(to, kind, vars);
  if (channel === "sms") throw new NotConfigured("SMS is not set up");
  return resendEmail(to, args.email?.subject ?? "Seiketsu", TEMPLATES[kind].text(vars), args.email?.html);
}