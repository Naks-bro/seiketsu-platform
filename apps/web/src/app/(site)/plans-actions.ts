"use server";

import { z } from "zod";
import { enquiries, getDb } from "@seiketsu/db";
import { indianMobile } from "@seiketsu/core/checkout-schema";
import { ENQUIRY_KEYS } from "@seiketsu/core/enquiry";
import { getStore } from "@/lib/server/catalog";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";

export type EnquiryState = { ok?: boolean; error?: string; fields?: Record<string, string>; values?: Record<string, string> } | undefined;

const input = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(80),
  phone: indianMobile,
  email: z.string().trim().email("Enter a valid email address").max(120),
  location: z.string().trim().min(2, "Tell us where you are").max(120),
  interest: z.enum(ENQUIRY_KEYS, { error: "Choose what you're interested in" }),
  message: z.string().trim().max(1000).optional(),
});

export async function sendEnquiryAction(_prev: EnquiryState, form: FormData): Promise<EnquiryState> {
  const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  // Bots fill every field; people never see this one.
  if (raw.website) return { ok: true };
  const parsed = input.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { error: "Please check the highlighted fields.", fields, values: raw };
  }
  if (!(await rateLimit(`enquiry:${await clientIp()}`, 5, 3600))) {
    return { error: "We've received your enquiries. We'll be in touch soon.", values: raw };
  }
  const store = await getStore();
  const d = parsed.data;
  const db = await getDb();
  await db.insert(enquiries).values({
    outletId: store.outletId,
    name: d.name,
    phone: d.phone,
    email: d.email,
    location: d.location,
    interest: d.interest,
    message: d.message || null,
  });
  return { ok: true };
}
