"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { replySchema, TICKET_STATUSES } from "@seiketsu/core/tickets";
import { can, requireStaff } from "@/lib/server/auth";
import { assignTicket, setPriority, setTicketStatus, staffReply } from "@/lib/server/tickets";

async function staff() {
  const s = await requireStaff();
  if (!can.manageOrders(s)) throw new Error("You do not have permission to do that.");
  return s;
}

const refresh = (id: string) => {
  revalidatePath(`/admin/tickets/${id}`);
  revalidatePath("/admin/tickets");
};

export type StaffReplyState = { error?: string; ok?: number } | undefined;

export async function staffReplyAction(_prev: StaffReplyState, form: FormData): Promise<StaffReplyState> {
  const s = await staff();
  const id = z.string().uuid().parse(form.get("id"));
  const body = replySchema.safeParse(form.get("message"));
  if (!body.success) return { error: body.error.issues[0].message };
  await staffReply(s.outletId, id, s.id, body.data, form.get("internal") === "on");
  refresh(id);
  return { ok: Date.now() };
}

export async function ticketStatusAction(form: FormData) {
  const s = await staff();
  const id = z.string().uuid().parse(form.get("id"));
  const to = z.enum(TICKET_STATUSES).parse(form.get("to"));
  await setTicketStatus(s.outletId, id, to, s.id);
  refresh(id);
}

export async function assignTicketAction(form: FormData) {
  const s = await staff();
  const id = z.string().uuid().parse(form.get("id"));
  const who = String(form.get("assignee") ?? "");
  await assignTicket(s.outletId, id, who ? z.string().uuid().parse(who) : null);
  refresh(id);
}

export async function priorityAction(form: FormData) {
  const s = await staff();
  const id = z.string().uuid().parse(form.get("id"));
  await setPriority(s.outletId, id, form.get("priority") === "high" ? "high" : "normal");
  refresh(id);
}
