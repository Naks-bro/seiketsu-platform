"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, storeSettings } from "@seiketsu/db";
import { indianMobile } from "@seiketsu/core/checkout-schema";
import { CUSTOMER_EVENTS, type MessagingSettings } from "@seiketsu/core/messaging";
import { can, requireStaff } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";

export type MessagingFormState = { error?: string; ok?: string } | undefined;

/** ₹ with up to 4 decimals → 1/1000 paise. */
const rate = (label: string) =>
  z.coerce.number({ message: `${label} must be a number` }).min(0, `${label} cannot be negative`).max(10, `${label} looks too high`).transform((r) => Math.round(r * 100_000));
const budget = (label: string) =>
  z.union([z.literal(""), z.coerce.number({ message: `${label} must be a number` }).min(1).max(1_000_000)]).transform((v) => (v === "" ? null : Math.round(v * 100)));

export async function saveMessagingAction(_prev: MessagingFormState, form: FormData): Promise<MessagingFormState> {
  const staff = await requireStaff();
  if (!can.manageSettings(staff)) return { error: "You do not have permission to change messaging." };
  try {
    const s = (k: string) => String(form.get(k) ?? "").trim();
    const alertEmail = s("alertEmail");
    const alertWhatsapp = s("alertWhatsapp");
    const messaging: MessagingSettings = {
      customerUpdates: Object.fromEntries(CUSTOMER_EVENTS.map((e) => [e, form.get(`update_${e}`) === "on"])) as MessagingSettings["customerUpdates"],
      smsFallback: form.get("smsFallback") === "on",
      rates: {
        sms: rate("SMS rate").parse(s("rate_sms")),
        whatsappAuthentication: rate("WhatsApp OTP rate").parse(s("rate_whatsappAuthentication")),
        whatsappUtility: rate("WhatsApp update rate").parse(s("rate_whatsappUtility")),
        whatsappMarketing: rate("WhatsApp marketing rate").parse(s("rate_whatsappMarketing")),
        email: rate("Email rate").parse(s("rate_email")),
      },
      dailyBudgetPaise: budget("Daily budget").parse(s("dailyBudget")),
      monthlyBudgetPaise: budget("Monthly budget").parse(s("monthlyBudget")),
      alertEmail: alertEmail ? z.string().email("Alert email is not valid").parse(alertEmail) : null,
      alertWhatsapp: alertWhatsapp ? indianMobile.parse(alertWhatsapp) : null,
    };
    const db = await getDb();
    await db.update(storeSettings).set({ messaging }).where(eq(storeSettings.outletId, staff.outletId));
    await audit(db, { actorId: staff.id, outletId: staff.outletId, action: "settings.messaging", entity: "store_settings", entityId: staff.outletId, data: messaging });
    revalidatePath("/admin/messages");
    return { ok: "Saved." };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    console.error("[admin] messaging save failed", err);
    return { error: "Could not save. Please try again." };
  }
}