"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { addons, getDb, menuItems, outletMenuItems, staffUsers, storeSettings } from "@seiketsu/db";
import { ORDER_STATUSES, REFUND_ON } from "@seiketsu/core/order-status";
import { verifyPassword } from "@seiketsu/core/password";
import { can, endSession, getStaff, homeFor, requireStaff, startSession } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { OrderError, refundOrder, transitionOrder } from "@/lib/server/orders";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";

export type ActionState = { error?: string; ok?: string } | undefined;

// A real scrypt hash of a random string, used to keep timing equal for unknown emails.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  // Per device, plus a looser cap per account so guessing from many addresses is slowed too.
  if (!(await rateLimit(`login:${await clientIp()}:${email}`, 5, 900)) || !(await rateLimit(`login-account:${email}`, 30, 3600))) {
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  }
  const db = await getDb();
  const [user] = await db.select().from(staffUsers).where(eq(staffUsers.email, email));
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) return { error: "That email and password do not match." };
  await db.update(staffUsers).set({ lastLoginAt: new Date() }).where(eq(staffUsers.id, user.id));
  await audit(db, { actorId: user.id, action: "staff.login", entity: "staff", entityId: user.id });
  await startSession(user.id, user.sessionVersion);
  const me = await getStaff();
  redirect(me ? homeFor(me) : "/admin/orders");
}

export async function logoutAction() {
  await endSession();
  redirect("/admin/login");
}

function message(err: unknown) {
  if (err instanceof OrderError) return err.message;
  if (err instanceof Error && err.message.includes("permission")) return err.message;
  console.error("[admin] action failed", err);
  return "Something went wrong. Please try again.";
}

const statusSchema = z.object({
  orderId: z.string().uuid(),
  to: z.enum(ORDER_STATUSES),
  reason: z.string().trim().max(300).optional(),
  refund: z.literal("on").optional(),
});

export async function changeStatusAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  try {
    if (!can.manageOrders(staff)) throw new Error("You do not have permission to do that.");
    const input = statusSchema.parse(Object.fromEntries(form));
    const order = await transitionOrder({ orderId: input.orderId, to: input.to, staffId: staff.id, outletId: staff.outletId, reason: input.reason });
    let note = "";
    if (REFUND_ON.includes(input.to) && input.refund && order.paymentState === "paid") {
      if (!can.refund(staff)) {
        note = " Ask the owner or a manager to issue the refund.";
      } else {
        const r = await refundOrder({ orderId: order.id, staffId: staff.id, outletId: staff.outletId, reason: input.reason ?? input.to });
        note = ` Refund of \u20b9${r.amountPaise / 100} started.`;
      }
    }
    revalidatePath("/admin/orders");
    return { ok: `Order ${order.orderNumber} updated.${note}` };
  } catch (err) {
    return { error: message(err) };
  }
}

export async function refundAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff(["owner", "manager"]);
  try {
    const orderId = z.string().uuid().parse(form.get("orderId"));
    const reason = z.string().trim().min(2, "Enter a reason").max(300).parse(form.get("reason"));
    const r = await refundOrder({ orderId, staffId: staff.id, outletId: staff.outletId, reason });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: `Refund of \u20b9${r.amountPaise / 100} started (${r.status}).` };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: message(err) };
  }
}

export async function setItemAvailabilityAction(form: FormData) {
  const staff = await requireStaff();
  if (!can.manageOrders(staff)) throw new Error("You do not have permission to do that.");
  const itemId = z.string().uuid().parse(form.get("itemId"));
  const available = form.get("available") === "true";
  const db = await getDb();
  const [item] = await db.select().from(menuItems).where(eq(menuItems.id, itemId));
  if (!item) return;
  if (available && item.needsReview) throw new Error("Fix this item before showing it to customers.");
  await db
    .update(outletMenuItems)
    .set({ isAvailable: available })
    .where(and(eq(outletMenuItems.menuItemId, itemId), eq(outletMenuItems.outletId, staff.outletId)));
  await audit(db, { actorId: staff.id, outletId: staff.outletId, action: available ? "menu.available" : "menu.sold_out", entity: "menu_item", entityId: itemId });
  revalidatePath("/admin/menu");
}

export async function setItemFlagAction(form: FormData) {
  const staff = await requireStaff();
  if (!can.manageMenu(staff)) throw new Error("You do not have permission to do that.");
  const itemId = z.string().uuid().parse(form.get("itemId"));
  const flag = z.enum(["isFeatured", "isBestseller"]).parse(form.get("flag"));
  const value = form.get("value") === "true";
  const db = await getDb();
  await db.update(menuItems).set({ [flag]: value }).where(eq(menuItems.id, itemId));
  await audit(db, { actorId: staff.id, outletId: staff.outletId, action: `menu.${flag}`, entity: "menu_item", entityId: itemId, data: { value } });
  revalidatePath("/admin/menu");
}

export async function setAddonAvailabilityAction(form: FormData) {
  const staff = await requireStaff();
  if (!can.manageOrders(staff)) throw new Error("You do not have permission to do that.");
  const addonId = z.string().uuid().parse(form.get("addonId"));
  const available = form.get("available") === "true";
  const db = await getDb();
  await db.update(addons).set({ isAvailable: available }).where(eq(addons.id, addonId));
  await audit(db, { actorId: staff.id, outletId: staff.outletId, action: available ? "addon.available" : "addon.sold_out", entity: "addon", entityId: addonId });
  revalidatePath("/admin/menu");
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const rupees = (label: string) =>
  z.coerce.number({ message: `${label} must be a number` }).min(0, `${label} cannot be negative`).max(100000);

export async function saveSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  if (!can.manageSettings(staff)) return { error: "You do not have permission to change settings." };
  try {
    const hours = Array.from({ length: 7 }, (_, d) =>
      form.get(`open_${d}`) === "on" ? { open: hhmm.parse(form.get(`from_${d}`)), close: hhmm.parse(form.get(`to_${d}`)) } : null,
    );
    const freeAbove = String(form.get("freeDeliveryAbove") ?? "").trim();

    const update: Partial<typeof storeSettings.$inferInsert> = {
      hours,
      temporarilyClosed: form.get("temporarilyClosed") === "on",
      closureMessage: String(form.get("closureMessage") ?? "").trim().slice(0, 200) || null,
      announcement: String(form.get("announcement") ?? "").trim().slice(0, 200) || null,
      pickupEnabled: form.get("pickupEnabled") === "on",
      deliveryEnabled: form.get("deliveryEnabled") === "on",
      deliveryFeePaise: Math.round(rupees("Delivery fee").parse(form.get("deliveryFee") || 0) * 100),
      freeDeliveryAbovePaise: freeAbove ? Math.round(rupees("Free delivery threshold").parse(freeAbove) * 100) : null,
      minOrderPaise: Math.round(rupees("Minimum order").parse(form.get("minOrder") || 0) * 100),
      prepTimeMinutes: z.coerce.number().int().min(5).max(180).parse(form.get("prepTime")),
    };
    if (can.manageTax(staff)) {
      update.taxEnabled = form.get("taxEnabled") === "on";
      update.taxRateBps = Math.round(z.coerce.number().min(0).max(28).parse(form.get("taxRate") || 0) * 100);
      update.taxInclusive = form.get("taxInclusive") === "on";
      update.gstin = String(form.get("gstin") ?? "").trim().toUpperCase() || null;
      if (update.gstin && !/^[0-9A-Z]{15}$/.test(update.gstin)) return { error: "GSTIN must be 15 letters and digits." };
    }
    const db = await getDb();
    await db.update(storeSettings).set(update).where(eq(storeSettings.outletId, staff.outletId));
    await audit(db, { actorId: staff.id, outletId: staff.outletId, action: "settings.update", entity: "store_settings", entityId: staff.outletId, data: update });
    revalidatePath("/", "layout");
    return { ok: "Settings saved." };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: message(err) };
  }
}