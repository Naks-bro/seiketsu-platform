"use server";

import { z } from "zod";
import { can, requireStaff } from "@/lib/server/auth";
import { createPosOrder, OrderError } from "@/lib/server/orders";
import { rateLimit } from "@/lib/server/rate-limit";

export type PosResult =
  | { ok: true; id: string; orderNumber: string; invoiceNumber: string | null; totalPaise: number; changePaise: number | null }
  | { ok: false; error: string };

export async function posSaleAction(payload: unknown): Promise<PosResult> {
  const staff = await requireStaff();
  if (!can.pos(staff)) return { ok: false, error: "You do not have permission to take counter orders." };
  if (!(await rateLimit(`pos:${staff.id}`, 120, 600))) return { ok: false, error: "Too many orders in a short time. Wait a minute." };
  try {
    const r = await createPosOrder(payload, staff);
    return { ok: true, ...r };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, error: err.issues[0].message };
    if (err instanceof OrderError) return { ok: false, error: err.message };
    console.error("[pos] sale failed", err);
    return { ok: false, error: "Could not save the order. Nothing was charged. Try again." };
  }
}