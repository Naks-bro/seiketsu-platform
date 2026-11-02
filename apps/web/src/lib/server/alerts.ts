import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, messageLog, outlets } from "@seiketsu/db";
import { budgetState, getMessagingSettings, sendMessage } from "./messaging/send";
import { otpCountSince } from "./customer-auth";
import { rateLimit } from "./rate-limit";
import { rupees } from "./notify-customer";

const OTP_SPIKE_PER_HOUR = Number(process.env.OTP_ALERT_PER_HOUR ?? 40);

async function alertOwner(outletId: string, key: string, everySeconds: number, message: string) {
  // One alert per key per window, however often the cron runs.
  if (!(await rateLimit(`alert:${key}`, 1, everySeconds))) return false;
  const s = await getMessagingSettings(outletId);
  console.warn(`[alert] ${message}`);
  const jobs = [];
  if (s.alertWhatsapp) jobs.push(sendMessage({ kind: "staff_alert", to: s.alertWhatsapp, vars: { message }, outletId, ignoreBudget: true }));
  if (s.alertEmail) {
    jobs.push(sendMessage({ kind: "staff_alert", channel: "email", to: s.alertEmail, vars: { message }, outletId, ignoreBudget: true, email: { subject: "Seiketsu alert" } }));
  }
  await Promise.all(jobs);
  return true;
}

/** Spend, delivery-failure and OTP-abuse checks. Run from the cron job. */
export async function checkAlerts() {
  const db = await getDb();
  const outletRows = await db.select({ id: outlets.id }).from(outlets).where(eq(outlets.isActive, true));
  const fired: string[] = [];
  for (const { id } of outletRows) {
    const s = await getMessagingSettings(id);
    const b = await budgetState(s);
    if (b.dayLevel !== "ok" && (await alertOwner(id, `day-${b.dayLevel}`, 86_400, `Messaging spend today is ${rupees(b.dayPaise)} of the ${rupees(s.dailyBudgetPaise ?? 0)} daily budget${b.dayLevel === "over" ? ". Order updates are paused until tomorrow." : "."}`))) fired.push("day");
    if (b.monthLevel !== "ok" && (await alertOwner(id, `month-${b.monthLevel}`, 7 * 86_400, `Messaging spend this month is ${rupees(b.monthPaise)} of the ${rupees(s.monthlyBudgetPaise ?? 0)} monthly budget.`))) fired.push("month");

    const hourAgo = new Date(Date.now() - 3600_000);
    const [r] = await db
      .select({
        total: sql<number>`count(*)::int`,
        failed: sql<number>`count(*) filter (where ${messageLog.status} = 'failed')::int`,
      })
      .from(messageLog)
      .where(and(eq(messageLog.outletId, id), gte(messageLog.createdAt, hourAgo), inArray(messageLog.status, ["sent", "delivered", "read", "failed"])));
    const total = Number(r?.total ?? 0);
    const failed = Number(r?.failed ?? 0);
    if (total >= 5 && failed / total > 0.2 && (await alertOwner(id, "failures", 6 * 3600, `${failed} of ${total} messages failed in the last hour. Check MSG91.`))) fired.push("failures");
  }
  const otps = await otpCountSince(new Date(Date.now() - 3600_000));
  if (otps >= OTP_SPIKE_PER_HOUR && outletRows[0] && (await alertOwner(outletRows[0].id, "otp-spike", 3 * 3600, `${otps} login codes were requested in the last hour. This may be abuse.`))) fired.push("otp");
  return fired;
}