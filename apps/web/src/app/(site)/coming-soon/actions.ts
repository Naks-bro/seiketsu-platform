"use server";

import { z } from "zod";
import { areaRequests, getDb } from "@seiketsu/db";
import { indianMobile } from "@seiketsu/core/checkout-schema";
import { PINCODE_RE } from "@seiketsu/core/delivery-area";
import { getStore } from "@/lib/server/catalog";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";

export type AreaState = { ok?: boolean; error?: string; fields?: Record<string, string> } | undefined;

const input = z.object({
  pincode: z.string().trim().regex(PINCODE_RE, "Enter your 6-digit pincode"),
  name: z.string().trim().min(2, "Tell us your name").max(80),
  phone: indianMobile,
  email: z.union([z.literal(""), z.string().trim().email("That email doesn't look right").max(120)]),
  area: z.string().trim().min(2, "Tell us your area or society").max(120),
  note: z.string().trim().max(300).optional(),
});

export async function requestAreaAction(_prev: AreaState, form: FormData): Promise<AreaState> {
  const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  // Bots fill every field; people never see this one.
  if (raw.website) return { ok: true };
  const parsed = input.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { error: "Please check the highlighted fields.", fields };
  }
  if (!(await rateLimit(`area-request:${await clientIp()}`, 5, 3600))) {
    return { error: "We've got your details already. We'll be in touch." };
  }
  const store = await getStore();
  const d = parsed.data;
  const db = await getDb();
  await db.insert(areaRequests).values({
    outletId: store.outletId,
    pincode: d.pincode,
    name: d.name,
    phone: d.phone,
    email: d.email || null,
    area: d.area,
    note: d.note || null,
  });
  return { ok: true };
}
