"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { newTicketSchema, replySchema } from "@seiketsu/core/tickets";
import { getStore } from "@/lib/server/catalog";
import { getCustomer } from "@/lib/server/customer-auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import { createTicket, customerReply, TicketError } from "@/lib/server/tickets";

export type SupportState = { error?: string; fields?: Record<string, string>; values?: Record<string, string> } | undefined;

const token = (v: FormDataEntryValue | null) => (typeof v === "string" && /^[\w-]{10,100}$/.test(v) ? v : null);

/** A new help request from the contact page, an order, a subscription or the account page. */
export async function openTicketAction(_prev: SupportState, form: FormData): Promise<SupportState> {
  const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  if (raw.website) return { error: "Something went wrong. Please try again." };
  const parsed = newTicketSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { error: "Please check the highlighted fields.", fields, values: raw };
  }
  if (!(await rateLimit(`ticket:${await clientIp()}`, 6, 3600))) {
    return { error: "We've received several requests from you. We'll reply soon; you can also message us on WhatsApp.", values: raw };
  }
  const [store, me] = await Promise.all([getStore(), getCustomer()]);
  const orderToken = token(form.get("order"));
  const subscriptionToken = token(form.get("subscription"));
  const t = await createTicket({
    ...parsed.data,
    outletId: store.outletId,
    customerId: me && me.phone === parsed.data.phone ? me.id : null,
    orderToken,
    subscriptionToken,
    source: orderToken ? "order" : subscriptionToken ? "subscription" : me ? "account" : "contact",
  });
  redirect(`/support/${t.publicToken}?new=1`);
}

export type ReplyState = { error?: string; ok?: number } | undefined;

export async function customerReplyAction(_prev: ReplyState, form: FormData): Promise<ReplyState> {
  const t = token(form.get("token"));
  const body = replySchema.safeParse(form.get("message"));
  if (!t) return { error: "Request not found." };
  if (!body.success) return { error: body.error.issues[0].message };
  if (!(await rateLimit(`ticket-reply:${await clientIp()}`, 20, 3600))) return { error: "Too many messages. Please wait a little." };
  try {
    await customerReply(t, body.data);
  } catch (err) {
    if (err instanceof TicketError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/support/${t}`);
  return { ok: Date.now() };
}
