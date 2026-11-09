"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@seiketsu/db";
import { isISODate, SUB_STATUSES, WEEKDAY_KEYS } from "@seiketsu/core/subscriptions";
import { can, requireStaff } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { recordOfflinePayment } from "@/lib/server/subscription-payments";
import { moveSubscription, recordDelivery, savePlan, saveStaffNotes, SubscriptionError, undoDelivery } from "@/lib/server/subscriptions";

export type PlanState = { error?: string; fields?: Record<string, string> } | undefined;

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const planInput = z.object({
  name: z.string().trim().min(2, "Give the plan a name").max(80),
  slug: z.string().trim().max(60).optional(),
  tagline: z.string().trim().max(140).optional(),
  description: z.string().trim().max(2000).optional(),
  mealsTotal: z.coerce.number({ message: "Enter the number of meals" }).int().min(1, "At least 1 meal").max(365),
  durationDays: z.coerce.number({ message: "Enter how many days it runs" }).int().min(1, "At least 1 day").max(366),
  price: z.coerce.number({ message: "Enter the price" }).min(1, "Enter the price").max(500000),
  includes: z.string().max(2000).optional(),
  sort: z.coerce.number().int().min(0).max(999).default(0),
});

async function staffFor(check: "manageMenu" | "manageOrders") {
  const staff = await requireStaff();
  if (!can[check](staff)) throw new Error("You do not have permission to do that.");
  return staff;
}

export async function savePlanAction(_prev: PlanState, form: FormData): Promise<PlanState> {
  let staff;
  try {
    staff = await staffFor("manageMenu");
  } catch (e) {
    return { error: (e as Error).message };
  }
  const raw = Object.fromEntries([...form.entries()].filter(([k]) => k !== "days").map(([k, v]) => [k, String(v)]));
  const parsed = planInput.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { error: "Please check the highlighted fields.", fields };
  }
  const d = parsed.data;
  if (d.mealsTotal > d.durationDays * 3) return { error: "Please check the highlighted fields.", fields: { mealsTotal: "That’s more than 3 meals a day for this many days" } };
  const days = form.getAll("days").map(String);
  const id = z.string().uuid().safeParse(form.get("id")).data;
  try {
    const row = await savePlan(
      staff.outletId,
      {
        name: d.name,
        slug: slugify(d.slug || d.name) || "plan",
        tagline: d.tagline || null,
        description: d.description || null,
        mealsTotal: d.mealsTotal,
        durationDays: d.durationDays,
        deliveryDays: WEEKDAY_KEYS.filter((k) => days.includes(k)),
        includes: (d.includes ?? "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 12),
        pricePaise: Math.round(d.price * 100),
        isActive: form.get("isActive") === "on",
        sort: d.sort,
      },
      id,
    );
    await audit(await getDb(), {
      actorId: staff.id,
      outletId: staff.outletId,
      action: id ? "subscription_plan.update" : "subscription_plan.create",
      entity: "subscription_plan",
      entityId: row.id,
      data: { name: row.name, active: row.isActive },
    });
  } catch (e) {
    if (e instanceof SubscriptionError) return { error: e.message, fields: { slug: e.message } };
    throw e;
  }
  revalidatePath("/admin/subscriptions/plans");
  revalidatePath("/");
  redirect("/admin/subscriptions/plans");
}

const refresh = (id: string) => {
  revalidatePath(`/admin/subscriptions/subscribers/${id}`);
  revalidatePath("/admin/subscriptions");
};

export async function moveSubscriptionAction(form: FormData) {
  const staff = await staffFor("manageMenu");
  const id = z.string().uuid().parse(form.get("id"));
  const to = z.enum(SUB_STATUSES).parse(form.get("to"));
  await moveSubscription(staff.outletId, id, to);
  await audit(await getDb(), { actorId: staff.id, outletId: staff.outletId, action: `subscription.${to}`, entity: "subscription", entityId: id });
  refresh(id);
}

/** Cash or UPI taken by staff: the first payment, or another cycle. Issues the invoice. */
export async function markPaidAction(form: FormData) {
  const staff = await staffFor("manageMenu");
  const id = z.string().uuid().parse(form.get("id"));
  const note = String(form.get("note") ?? "").trim().slice(0, 200) || null;
  await recordOfflinePayment(staff.outletId, id, { note, staffId: staff.id });
  refresh(id);
}

export async function saveStaffNotesAction(form: FormData) {
  const staff = await staffFor("manageOrders");
  const id = z.string().uuid().parse(form.get("id"));
  await saveStaffNotes(staff.outletId, id, String(form.get("staffNotes") ?? "").trim().slice(0, 2000) || null);
  refresh(id);
}

export async function recordDeliveryAction(form: FormData) {
  const staff = await staffFor("manageOrders");
  const id = z.string().uuid().parse(form.get("id"));
  const date = z.string().refine(isISODate).parse(form.get("date"));
  const status = z.enum(["delivered", "skipped"]).parse(form.get("status"));
  try {
    await recordDelivery(staff.outletId, id, date, status, staff.id);
  } catch (e) {
    // A double tap or a stale page: the day is already recorded, nothing to do.
    if (!(e instanceof SubscriptionError)) throw e;
  }
  refresh(id);
}

export async function undoDeliveryAction(form: FormData) {
  const staff = await staffFor("manageOrders");
  const id = z.string().uuid().parse(form.get("id"));
  const date = z.string().refine(isISODate).parse(form.get("date"));
  await undoDelivery(staff.outletId, id, date);
  await audit(await getDb(), { actorId: staff.id, outletId: staff.outletId, action: "subscription.delivery_undone", entity: "subscription", entityId: id, data: { date } });
  refresh(id);
}
