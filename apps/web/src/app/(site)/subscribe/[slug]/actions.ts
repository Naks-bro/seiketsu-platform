"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { indianMobile } from "@seiketsu/core/checkout-schema";
import { isServiceable, PINCODE_RE } from "@seiketsu/core/delivery-area";
import { addDays, isISODate, istToday } from "@seiketsu/core/subscriptions";
import { getStore } from "@/lib/server/catalog";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import { createSubscription, getActivePlanBySlug } from "@/lib/server/subscriptions";

export type SubscribeState = { error?: string; fields?: Record<string, string>; values?: Record<string, string> } | undefined;

const input = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(2, "Tell us your name").max(80),
  phone: indianMobile,
  email: z.union([z.literal(""), z.string().trim().email("That email doesn't look right").max(120)]),
  address: z.string().trim().min(10, "Add your full delivery address").max(400),
  pincode: z.string().trim().regex(PINCODE_RE, "Enter your 6-digit pincode"),
  startDate: z.string().refine(isISODate, "Pick a start date"),
  notes: z.string().trim().max(500).optional(),
});

const bad = (fields: Record<string, string>, values: Record<string, string>) => ({ error: "Please check the highlighted fields.", fields, values });

/** Starts a subscription request. The owner confirms it and collects payment, then it becomes active. */
export async function subscribeAction(_prev: SubscribeState, form: FormData): Promise<SubscribeState> {
  const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  if (raw.website) return { error: "Something went wrong. Please try again." };
  const parsed = input.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return bad(fields, raw);
  }
  const d = parsed.data;
  const today = istToday();
  if (d.startDate <= today || d.startDate > addDays(today, 60)) return bad({ startDate: "Pick a day from tomorrow up to 60 days ahead" }, raw);
  const store = await getStore();
  if (!isServiceable(d.pincode, store.deliveryPincodes)) return bad({ pincode: "We don't deliver to this pincode yet" }, raw);
  const plan = await getActivePlanBySlug(store.outletId, d.slug);
  if (!plan) return { error: "This plan is no longer available.", values: raw };
  if (!(await rateLimit(`subscribe:${await clientIp()}`, 5, 3600))) {
    return { error: "We've received your requests. We'll be in touch soon.", values: raw };
  }
  const sub = await createSubscription({
    outletId: store.outletId,
    plan,
    name: d.name,
    phone: d.phone,
    email: d.email || null,
    address: d.address,
    pincode: d.pincode,
    startDate: d.startDate,
    notes: d.notes || null,
  });
  redirect(`/subscription/${sub.publicToken}?new=1`);
}
