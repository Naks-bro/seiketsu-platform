"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, requireStaff, type Staff } from "@/lib/server/auth";
import { InventoryError, recordMovement, saveIngredient, saveRecipe, saveSupplier, setIngredientActive } from "@/lib/server/inventory";

export type InvResult = { ok?: string; error?: string; fieldErrors?: Record<string, string> } | undefined;

const DENIED = { error: "You do not have permission to do that." };

/** Turns validation and inventory errors into a message for the form; anything else is logged. */
function fail(err: unknown, what: string): InvResult {
  if (err instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const i of err.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { error: err.issues[0]?.message ?? "Please check the form.", fieldErrors };
  }
  if (err instanceof InventoryError) return { error: err.message };
  console.error(`[inventory] ${what} failed`, err);
  return { error: `Could not ${what}. Please try again.` };
}

async function staffWith(check: (s: Staff) => boolean) {
  const staff = await requireStaff();
  return check(staff) ? staff : null;
}

export async function recordMovementAction(_prev: InvResult, form: FormData): Promise<InvResult> {
  const staff = await staffWith(can.inventory);
  if (!staff) return DENIED;
  try {
    const { ingredient } = await recordMovement(Object.fromEntries(form), staff);
    revalidatePath("/admin/inventory", "layout");
    const kind = form.get("kind");
    const verb = kind === "purchase" ? "Delivery recorded" : kind === "wastage" ? "Wastage recorded" : "Count saved";
    return { ok: `${verb} for ${ingredient.name}.` };
  } catch (err) {
    return fail(err, "record that");
  }
}

export async function saveIngredientAction(_prev: InvResult, form: FormData): Promise<InvResult> {
  const staff = await staffWith(can.inventory);
  if (!staff) return DENIED;
  const raw = Object.fromEntries(form);
  try {
    await saveIngredient({ ...raw, id: raw.id || undefined }, staff);
    revalidatePath("/admin/inventory", "layout");
    return { ok: raw.id ? "Saved." : `Added ${String(raw.name).trim()}.` };
  } catch (err) {
    return fail(err, "save the ingredient");
  }
}

export async function archiveIngredientAction(form: FormData) {
  const staff = await staffWith(can.inventory);
  if (!staff) throw new Error(DENIED.error);
  const id = z.string().uuid().parse(form.get("id"));
  await setIngredientActive(id, form.get("active") === "true", staff);
  revalidatePath("/admin/inventory", "layout");
}

export async function saveSupplierAction(_prev: InvResult, form: FormData): Promise<InvResult> {
  const staff = await staffWith(can.inventory);
  if (!staff) return DENIED;
  const raw = Object.fromEntries(form);
  try {
    await saveSupplier({ ...raw, id: raw.id || undefined }, staff);
    revalidatePath("/admin/inventory", "layout");
    return { ok: raw.id ? "Saved." : `Added ${String(raw.name).trim()}.` };
  } catch (err) {
    return fail(err, "save the supplier");
  }
}

export async function saveRecipeAction(payload: unknown): Promise<InvResult> {
  const staff = await staffWith(can.manageRecipes);
  if (!staff) return { error: "Only owners and managers can change recipes." };
  try {
    await saveRecipe(payload, staff);
    revalidatePath("/admin/inventory", "layout");
    return { ok: "Recipe saved." };
  } catch (err) {
    return fail(err, "save the recipe");
  }
}
