"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { addons, getDb, menuItems } from "@seiketsu/db";
import { can, requireStaff } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { saveMenuItem } from "@/lib/server/menu-admin";

export type MenuSaveResult = { ok?: true; id?: string; error?: string; fieldErrors?: Record<string, string> };

export async function saveMenuItemAction(payload: unknown): Promise<MenuSaveResult> {
  const staff = await requireStaff();
  if (!can.manageMenu(staff)) return { error: "You do not have permission to edit the menu." };
  try {
    const id = await saveMenuItem(payload, staff.outletId);
    const db = await getDb();
    await audit(db, { actorId: staff.id, outletId: staff.outletId, action: "menu.save", entity: "menu_item", entityId: id });
    revalidatePath("/", "layout");
    return { ok: true, id };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of err.issues) fieldErrors[i.path.join(".")] ??= i.message;
      return { error: "Please check the highlighted fields.", fieldErrors };
    }
    console.error("[menu] save failed", err);
    return { error: err instanceof Error ? err.message : "Could not save the dish." };
  }
}

/** Removes a dish from the menu. It stays in the database so past orders and bills still show it. */
export async function archiveMenuItemAction(itemId: string): Promise<MenuSaveResult> {
  const staff = await requireStaff();
  if (!can.manageMenu(staff)) return { error: "You do not have permission to edit the menu." };
  if (!z.string().uuid().safeParse(itemId).success) return { error: "Dish not found." };
  const db = await getDb();
  await db.update(menuItems).set({ deletedAt: new Date() }).where(eq(menuItems.id, itemId));
  await audit(db, { actorId: staff.id, outletId: staff.outletId, action: "menu.archive", entity: "menu_item", entityId: itemId });
  revalidatePath("/", "layout");
  return { ok: true };
}

const addonInput = z.object({
  addonId: z.string().uuid(),
  name: z.string().trim().min(2, "Enter the extra's name").max(60),
  price: z.coerce.number().min(0).max(10_000),
});

export async function saveAddonAction(_prev: { error?: string; ok?: string } | undefined, form: FormData) {
  const staff = await requireStaff();
  if (!can.manageMenu(staff)) return { error: "You do not have permission to edit the menu." };
  const parsed = addonInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await getDb();
  await db.update(addons).set({ name: parsed.data.name, pricePaise: Math.round(parsed.data.price * 100) }).where(eq(addons.id, parsed.data.addonId));
  await audit(db, { actorId: staff.id, outletId: staff.outletId, action: "addon.save", entity: "addon", entityId: parsed.data.addonId, data: parsed.data });
  revalidatePath("/", "layout");
  return { ok: "Saved" };
}