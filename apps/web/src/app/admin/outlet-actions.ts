"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@seiketsu/db";
import { can, requireStaff } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { ADMIN_OUTLET_COOKIE, createOutlet, OutletError, staffOutlets, updateOutlet } from "@/lib/server/outlets";

export type OutletState = { error?: string; ok?: string } | undefined;

export async function switchAdminOutletAction(form: FormData) {
  const staff = await requireStaff();
  const id = z.string().uuid().parse(form.get("outletId"));
  if (!(await staffOutlets(staff.id)).some((o) => o.id === id)) throw new Error("You don’t work at that outlet.");
  (await cookies()).set(ADMIN_OUTLET_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/admin");
}

const slugify = (s: string) => s.toLowerCase().replace(/^seiketsu\s+/, "").normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const opt = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

function fields(form: FormData) {
  const name = z.string().trim().min(2, "Give the outlet a name").max(80).parse(form.get("name"));
  const addressLines = String(form.get("address") ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 5);
  if (!addressLines.length) throw new OutletError("Add the outlet’s address.");
  const mapUrl = opt(form.get("mapUrl"));
  if (mapUrl && !/^https:\/\//.test(mapUrl)) throw new OutletError("The map link should start with https://");
  return { name, addressLines, phone: opt(form.get("phone")), whatsapp: opt(form.get("whatsapp"))?.replace(/\D/g, "") || null, instagram: opt(form.get("instagram")), mapUrl };
}

export async function createOutletAction(_prev: OutletState, form: FormData): Promise<OutletState> {
  const staff = await requireStaff();
  if (!can.manageStaff(staff)) return { error: "Only the owner can open a new outlet." };
  try {
    const f = fields(form);
    const o = await createOutlet(staff.outletId, { ...f, slug: slugify(String(form.get("slug") || f.name)) || "outlet" }, staff.id);
    await audit(await getDb(), { actorId: staff.id, outletId: o.id, action: "outlet.create", entity: "outlet", entityId: o.id, data: { name: o.name } });
  } catch (e) {
    if (e instanceof OutletError || e instanceof z.ZodError) return { error: e instanceof z.ZodError ? e.issues[0].message : e.message };
    throw e;
  }
  revalidatePath("/admin/outlets");
  return { ok: "Outlet created. Switch to it from the sidebar to set its hours, pincodes and menu, then open it in Settings." };
}

export async function updateOutletAction(_prev: OutletState, form: FormData): Promise<OutletState> {
  const staff = await requireStaff();
  if (!can.manageStaff(staff)) return { error: "Only the owner can change outlets." };
  try {
    const id = z.string().uuid().parse(form.get("id"));
    if (!(await staffOutlets(staff.id)).some((o) => o.id === id && o.role === "owner")) throw new OutletError("You do not own that outlet.");
    await updateOutlet(id, { ...fields(form), isActive: form.get("isActive") === "on" });
    await audit(await getDb(), { actorId: staff.id, outletId: id, action: "outlet.update", entity: "outlet", entityId: id });
  } catch (e) {
    if (e instanceof OutletError || e instanceof z.ZodError) return { error: e instanceof z.ZodError ? e.issues[0].message : e.message };
    throw e;
  }
  revalidatePath("/admin/outlets");
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}
