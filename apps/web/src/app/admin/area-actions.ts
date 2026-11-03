"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@seiketsu/db";
import { can, requireStaff } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { markAreaRequestContacted } from "@/lib/server/area-requests";

export async function markContactedAction(form: FormData) {
  const staff = await requireStaff();
  if (!can.manageSettings(staff)) throw new Error("You do not have permission to do that.");
  const id = z.string().uuid().parse(form.get("id"));
  if (await markAreaRequestContacted(id, staff.outletId)) {
    await audit(await getDb(), { actorId: staff.id, outletId: staff.outletId, action: "area_request.contacted", entity: "area_request", entityId: id });
  }
  revalidatePath("/admin/area-requests");
}
