"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { customers, getDb } from "@seiketsu/db";
import { can, requireStaff } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { adjustPoints } from "@/lib/server/rewards";

async function staff() {
  const s = await requireStaff();
  if (!can.reports(s)) throw new Error("You do not have permission to do that.");
  return s;
}

export async function saveCustomerNotesAction(form: FormData) {
  const s = await staff();
  const id = z.string().uuid().parse(form.get("id"));
  const notes = String(form.get("notes") ?? "").trim().slice(0, 2000) || null;
  const tags = [...new Set(String(form.get("tags") ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10).map((t) => t.slice(0, 30));
  const db = await getDb();
  await db.update(customers).set({ notes, tags }).where(eq(customers.id, id));
  await audit(db, { actorId: s.id, outletId: s.outletId, action: "customer.notes", entity: "customer", entityId: id, data: { tags } });
  revalidatePath(`/admin/customers/${id}`);
}

export async function adjustPointsAction(form: FormData) {
  const s = await staff();
  const id = z.string().uuid().parse(form.get("id"));
  const points = z.coerce.number().int().refine((n) => n !== 0 && Math.abs(n) <= 100000).parse(form.get("points"));
  const note = z.string().trim().min(2).max(200).parse(form.get("note"));
  await adjustPoints(id, points, note, s.id);
  await audit(await getDb(), { actorId: s.id, outletId: s.outletId, action: "loyalty.adjust", entity: "customer", entityId: id, data: { points, note } });
  revalidatePath(`/admin/customers/${id}`);
}
