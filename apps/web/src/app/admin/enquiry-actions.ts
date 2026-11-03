"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@seiketsu/db";
import { can, requireStaff } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { markEnquiryContacted } from "@/lib/server/enquiries";

export async function markEnquiryContactedAction(form: FormData) {
  const staff = await requireStaff();
  if (!can.manageSettings(staff)) throw new Error("You do not have permission to do that.");
  const id = z.string().uuid().parse(form.get("id"));
  if (await markEnquiryContacted(id, staff.outletId)) {
    await audit(await getDb(), { actorId: staff.id, outletId: staff.outletId, action: "enquiry.contacted", entity: "enquiry", entityId: id });
  }
  revalidatePath("/admin/enquiries");
}
