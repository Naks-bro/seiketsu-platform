"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { customers, getDb } from "@seiketsu/db";
import { endCustomerSession, getCustomer, setConsent } from "@/lib/server/customer-auth";
import { clientIp } from "@/lib/server/request";

export type ProfileState = { error?: string; ok?: string } | undefined;

const profile = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email").max(120)]),
});

export async function saveProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const me = await getCustomer();
  if (!me) redirect("/account");
  const parsed = profile.safeParse({ name: form.get("name") ?? "", email: form.get("email") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await getDb();
  const email = parsed.data.email || null;
  await db.update(customers).set({ name: parsed.data.name, email }).where(eq(customers.id, me.id));
  // Email offers need an email address.
  if (!email && me.marketingEmail) await setConsent(me.id, "email", false, "account", await clientIp());
  revalidatePath("/account");
  return { ok: "Saved." };
}

export async function setConsentAction(form: FormData) {
  const me = await getCustomer();
  if (!me) redirect("/account");
  const channel = form.get("channel") === "email" ? "email" : "whatsapp";
  const granted = form.get("granted") === "true";
  if (channel === "email" && granted && !me.email) return;
  await setConsent(me.id, channel, granted, "account", await clientIp());
  revalidatePath("/account");
}

export async function customerLogoutAction() {
  await endCustomerSession();
  redirect("/");
}