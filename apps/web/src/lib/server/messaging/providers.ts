import "server-only";
import { randomBytes } from "node:crypto";
import { maskPhone } from "@seiketsu/core/messaging";
import { env } from "../env";
import { TEMPLATES, type TemplateKind } from "./templates";

export type Channel = "whatsapp" | "sms" | "email";
export type SendResult = { providerMessageId: string | null };
export class NotConfigured extends Error {}

const MSG91_WA_URL = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";
const MSG91_SMS_URL = "https://control.msg91.com/api/v5/flow";

const intl = (phone: string) => `91${phone.replace(/\D/g, "").slice(-10)}`;

/** Is this channel able to send this kind right now? */
export function channelReady(channel: Channel, kind: TemplateKind): boolean {
  const m = env.messaging;
  if (m.mode === "disabled") return false;
  if (m.mode === "log") return true;
  if (channel === "email") return !!m.resendApiKey && !!m.emailFrom;
  if (channel === "whatsapp") return !!m.msg91.whatsappNumber && !!m.template("WA", kind);
  return !!m.template("SMS", kind);
}

export function providerName(channel: Channel) {
  if (env.messaging.mode === "log") return "log";
  return channel === "email" ? "resend" : "msg91";
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

async function msg91WhatsApp(to: string, kind: TemplateKind, vars: Record<string, string>): Promise<SendResult> {
  const name = env.messaging.template("WA", kind);
  const number = env.messaging.msg91.whatsappNumber;
  if (!name || !number) throw new NotConfigured(`WhatsApp template for ${kind} not configured`);
  const t = TEMPLATES[kind];
  const components: Record<string, unknown> = {};
  t.vars.forEach((k, i) => (components[`body_${i + 1}`] = { type: "text", value: vars[k] ?? "" }));
  // Authentication templates carry the code again on their copy-code button.
  if (t.category === "authentication") components.button_1 = { subtype: "url", type: "text", value: vars.code };
  const json = await postJson(
    MSG91_WA_URL,
    {
      integrated_number: number,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name,
          language: { code: "en", policy: "deterministic" },
          namespace: null,
          to_and_components: [{ to: [intl(to)], components }],
        },
      },
    },
    { authkey: env.messaging.msg91.authKey! },
  );
  return { providerMessageId: String(json.request_id ?? json.requestId ?? json.data ?? "") || null };
}

async function msg91Sms(to: string, kind: TemplateKind, vars: Record<string, string>): Promise<SendResult> {
  const templateId = env.messaging.template("SMS", kind);
  if (!templateId) throw new NotConfigured(`SMS template for ${kind} not configured`);
  const recipient: Record<string, string> = { mobiles: intl(to) };
  TEMPLATES[kind].vars.forEach((k, i) => (recipient[`var${i + 1}`] = vars[k] ?? ""));
  const json = await postJson(
    MSG91_SMS_URL,
    { template_id: templateId, short_url: "0", recipients: [recipient] },
    { authkey: env.messaging.msg91.authKey! },
  );
  return { providerMessageId: String(json.message ?? json.request_id ?? "") || null };
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
  if (channel === "whatsapp") return msg91WhatsApp(to, kind, vars);
  if (channel === "sms") return msg91Sms(to, kind, vars);
  return resendEmail(to, args.email?.subject ?? "Seiketsu", TEMPLATES[kind].text(vars), args.email?.html);
}