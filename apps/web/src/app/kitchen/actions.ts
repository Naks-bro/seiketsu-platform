"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ORDER_STATUSES } from "@seiketsu/core/order-status";
import { can, requireStaff } from "@/lib/server/auth";
import { OrderError, transitionOrder } from "@/lib/server/orders";

const input = z.object({ orderId: z.string().uuid(), to: z.enum(ORDER_STATUSES) });

/** One-tap status change from the kitchen screen. Rejections/cancellations stay in Orders (they need a reason and a refund). */
export async function bumpOrderAction(orderId: string, to: string): Promise<{ error?: string }> {
  const staff = await requireStaff();
  if (!can.kitchen(staff)) return { error: "You do not have permission to do that." };
  const parsed = input.safeParse({ orderId, to });
  if (!parsed.success || ["rejected", "cancelled"].includes(parsed.data.to)) return { error: "That change is not allowed here." };
  try {
    await transitionOrder({ orderId, to: parsed.data.to, staffId: staff.id, outletId: staff.outletId });
    revalidatePath("/kitchen");
    return {};
  } catch (err) {
    return { error: err instanceof OrderError ? err.message : "Could not update the order. Try again." };
  }
}