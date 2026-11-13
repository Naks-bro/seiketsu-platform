import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, messageLog, storeSettings } from "@seiketsu/db";
import {
  messageCost,
  milliPaiseToPaise,
  parseDeliveryStatus,
  spendLevel,
  withMessagingDefaults,
  type MessagingSettings,
} from "@seiketsu/core/messaging";
import { channelReady, deliver, NotConfigured, providerName, type Channel } from "./providers";
import { TEMPLATES, type TemplateKind } from "./templates";
import { orderUpdateText } from "@seiketsu/core/whatsapp-replies";
import { env } from "../env";
import { sendFreeText, serviceWindowOpen } from "../whatsapp-inbox";

export async function getMessagingSettings(outletId: string | null): Promise<MessagingSettings> {
  if (!outletId) return withMessagingDefaults(null);
  const db = await getDb();
  const [row] = await db.select({ m: storeSettings.messaging }).from(storeSettings).where(eq(storeSettings.outletId, outletId));
  return withMessagingDefaults(row?.m);
}

/** Midnight today in India, as a Date. */
export function istDayStart(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60_000);
}

export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export function istMonthStart(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 330 * 60_000);
}

const BILLED = ["sent", "delivered", "read"] as const;

/** Estimated spend (paise) on messages sent since a moment. */
export async function spentSince(since: Date): Promise<number> {
  const db = await getDb();
  const [r] = await db
    .select({ m: sql<number>`coalesce(sum(${messageLog.costMilliPaise}), 0)::int` })
    .from(messageLog)
    .where(and(gte(messageLog.createdAt, since), inArray(messageLog.status, [...BILLED])));
  return milliPaiseToPaise(Number(r?.m ?? 0));
}

export async function budgetState(settings: MessagingSettings) {
  const [day, month] = await Promise.all([spentSince(istDayStart()), spentSince(istMonthStart())]);
  const dayLevel = spendLevel(day, settings.dailyBudgetPaise);
  const monthLevel = spendLevel(month, settings.monthlyBudgetPaise);
  return { dayPaise: day, monthPaise: month, dayLevel, monthLevel, blocked: dayLevel === "over" || monthLevel === "over" };
}

export type SendArgs = {
  kind: TemplateKind;
  to: string;
  vars: Record<string, string>;
  channel?: Channel;
  outletId?: string | null;
  orderId?: string | null;
  customerId?: string | null;
  email?: { subject: string; html?: string };
  /** OTPs and owner alerts still go out when the budget is used up */
  ignoreBudget?: boolean;
  fallbackOf?: string | null;
};

export type SendOutcome = { id: string; channel: Channel; status: "sent" | "failed" | "skipped"; error?: string };

/**
 * Sends one message and records it in message_log with its estimated cost.
 * WhatsApp is tried first; if it is not set up or fails, the SMS template is
 * used when SMS fallback is on.
 */
export async function sendMessage(a: SendArgs): Promise<SendOutcome> {
  const db = await getDb();
  const t = TEMPLATES[a.kind];
  const settings = await getMessagingSettings(a.outletId ?? null);
  let channel: Channel = a.channel ?? "whatsapp";
  if (channel === "whatsapp" && !channelReady("whatsapp", a.kind) && t.sms && channelReady("sms", a.kind)) channel = "sms";

  const base = {
    outletId: a.outletId ?? null,
    orderId: a.orderId ?? null,
    customerId: a.customerId ?? null,
    channel,
    kind: a.kind,
    category: t.category,
    recipient: a.to,
    provider: providerName(channel),
    vars: t.secret ? null : a.vars,
    fallbackOf: a.fallbackOf ?? null,
  };

  const skip = async (reason: string): Promise<SendOutcome> => {
    const [row] = await db.insert(messageLog).values({ ...base, status: "skipped", error: reason }).returning({ id: messageLog.id });
    return { id: row.id, channel, status: "skipped", error: reason };
  };

  // Meta WhatsApp: a free reply when the customer messaged us in the last 24 hours. Otherwise a paid template,
  // only if the owner switched those on; by default the message is skipped so WhatsApp never costs anything.
  if (channel === "whatsapp" && env.messaging.mode === "live" && env.messaging.meta && !a.fallbackOf) {
    const phone = a.to.replace(/\D/g, "").slice(-10);
    const free = orderUpdateText(a.kind, a.vars) ?? (a.kind === "staff_alert" ? t.text(a.vars) : null);
    if (free && (await serviceWindowOpen(phone))) {
      return sendFreeText({ to: phone, body: free, kind: a.kind, outletId: a.outletId, orderId: a.orderId, customerId: a.customerId });
    }
    if (!env.messaging.paidTemplates) return skip("outside the free 24-hour WhatsApp reply window");
  }

  if (!channelReady(channel, a.kind)) return skip(`${channel} not configured for ${a.kind}`);
  if (!a.ignoreBudget && t.category !== "authentication" && (await budgetState(settings)).blocked) {
    return skip("messaging budget reached");
  }

  const [row] = await db
    .insert(messageLog)
    .values({ ...base, status: "queued", costMilliPaise: messageCost(channel, t.category, settings.rates) })
    .returning({ id: messageLog.id });

  try {
    const r = await deliver({ channel, kind: a.kind, to: a.to, vars: a.vars, email: a.email });
    await db.update(messageLog).set({ status: "sent", providerMessageId: r.providerMessageId }).where(eq(messageLog.id, row.id));
    return { id: row.id, channel, status: "sent" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.update(messageLog).set({ status: err instanceof NotConfigured ? "skipped" : "failed", error }).where(eq(messageLog.id, row.id));
    console.error(`[message] ${channel} ${a.kind} failed:`, error);
    if (channel === "whatsapp" && t.sms && settings.smsFallback && !a.fallbackOf) {
      return sendMessage({ ...a, channel: "sms", fallbackOf: row.id });
    }
    return { id: row.id, channel, status: "failed", error };
  }
}

/** True if this order already got (or is getting) this kind of message. */
export async function alreadySent(orderId: string, kind: TemplateKind) {
  const db = await getDb();
  const [r] = await db
    .select({ id: messageLog.id })
    .from(messageLog)
    .where(and(eq(messageLog.orderId, orderId), eq(messageLog.kind, kind), inArray(messageLog.status, ["queued", ...BILLED])))
    .limit(1);
  return !!r;
}

/**
 * Applies a provider delivery report. A failed WhatsApp message is resent by
 * SMS once, when fallback is on and the template allows it.
 */
export async function applyDeliveryReport(providerMessageId: string, rawStatus: unknown, error?: string | null) {
  const status = parseDeliveryStatus(rawStatus);
  if (!status) return 0;
  const db = await getDb();
  const rows = await db
    .update(messageLog)
    .set({ status, ...(status === "failed" ? { error: error ?? String(rawStatus) } : {}) })
    .where(eq(messageLog.providerMessageId, providerMessageId))
    .returning();
  for (const m of rows) {
    if (status !== "failed" || m.channel !== "whatsapp" || !m.vars) continue;
    const kind = m.kind as TemplateKind;
    if (!TEMPLATES[kind]?.sms) continue;
    const settings = await getMessagingSettings(m.outletId);
    if (!settings.smsFallback) continue;
    const [existing] = await db.select({ id: messageLog.id }).from(messageLog).where(eq(messageLog.fallbackOf, m.id)).limit(1);
    if (existing) continue;
    await sendMessage({ kind, to: m.recipient, vars: m.vars, channel: "sms", outletId: m.outletId, orderId: m.orderId, customerId: m.customerId, fallbackOf: m.id });
  }
  return rows.length;
}

