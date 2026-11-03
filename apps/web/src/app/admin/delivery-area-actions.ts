"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, storeSettings } from "@seiketsu/db";
import { isPincode, MAX_PINCODES, mergePincodes } from "@seiketsu/core/delivery-area";
import { can, requireStaff } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";

export type PincodeState = { ok?: string; error?: string } | undefined;

async function current(outletId: string) {
  const db = await getDb();
  const [s] = await db.select({ pins: storeSettings.deliveryPincodes }).from(storeSettings).where(eq(storeSettings.outletId, outletId));
  return s?.pins ?? [];
}

async function save(staffId: string, outletId: string, pins: string[], action: string, data: Record<string, unknown>) {
  const db = await getDb();
  await db.update(storeSettings).set({ deliveryPincodes: pins }).where(eq(storeSettings.outletId, outletId));
  await audit(db, { actorId: staffId, outletId, action, entity: "store_settings", entityId: outletId, data });
  revalidatePath("/", "layout");
}

async function staffWhoCanEdit() {
  const staff = await requireStaff();
  if (!can.manageSettings(staff)) throw new Error("You do not have permission to change delivery areas.");
  return staff;
}

/** Adds pincodes to the list, or replaces it. `pins` is a comma-separated list already read from the text or file. */
export async function savePincodesAction(_prev: PincodeState, form: FormData): Promise<PincodeState> {
  let staff;
  try {
    staff = await staffWhoCanEdit();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const mode = form.get("mode") === "replace" ? "replace" : "add";
  const incoming = String(form.get("pins") ?? "").split(",").map((p) => p.trim()).filter(isPincode);
  if (!incoming.length) return { error: "No valid pincodes to save. A pincode is 6 digits and does not start with 0." };
  const pins = await current(staff.outletId);
  const next = mergePincodes(pins, incoming, mode);
  if (next.length > MAX_PINCODES) return { error: `That would make ${next.length} pincodes; the limit is ${MAX_PINCODES}.` };
  const added = next.filter((p) => !pins.includes(p)).length;
  await save(staff.id, staff.outletId, next, mode === "replace" ? "delivery_pincodes.replace" : "delivery_pincodes.add", { added, total: next.length });
  return { ok: mode === "replace" ? `Your list now has ${next.length} pincodes.` : `Added ${added} pincode${added === 1 ? "" : "s"}. You now deliver to ${next.length}.` };
}

/** One-click add, from the area requests page. */
export async function addPincodeAction(form: FormData) {
  const staff = await staffWhoCanEdit();
  const pin = String(form.get("pin") ?? "");
  if (!isPincode(pin)) throw new Error("That is not a valid pincode.");
  const pins = await current(staff.outletId);
  if (pins.includes(pin)) return;
  await save(staff.id, staff.outletId, mergePincodes(pins, [pin], "add"), "delivery_pincodes.add", { pin });
  revalidatePath("/admin/area-requests");
}

export async function removePincodeAction(form: FormData) {
  const staff = await staffWhoCanEdit();
  const pin = String(form.get("pin") ?? "");
  const pins = await current(staff.outletId);
  if (!pins.includes(pin)) return;
  await save(staff.id, staff.outletId, pins.filter((p) => p !== pin), "delivery_pincodes.remove", { pin });
}

export async function clearPincodesAction() {
  const staff = await staffWhoCanEdit();
  const pins = await current(staff.outletId);
  if (!pins.length) return;
  await save(staff.id, staff.outletId, [], "delivery_pincodes.clear", { removed: pins.length });
}
