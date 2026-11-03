"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { coupons, getDb } from "@seiketsu/db";
import { COUPON_CODE_RE, normalizeCode } from "@seiketsu/core/coupons";
import { can, requireStaff } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";

export type CouponState = { error?: string; fields?: Record<string, string> } | undefined;

const optNum = (msg: string) => z.union([z.literal(""), z.coerce.number({ message: msg }).min(0, msg)]).optional();
const input = z.object({
  code: z.string().transform(normalizeCode).pipe(z.string().regex(COUPON_CODE_RE, "3–20 letters or numbers, e.g. WELCOME10")),
  description: z.string().trim().max(140).optional(),
  kind: z.enum(["percent", "flat"]),
  value: z.coerce.number({ message: "Enter the discount" }).positive("Enter the discount"),
  minSubtotal: optNum("Enter an amount"),
  maxDiscount: optNum("Enter an amount"),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  usageLimit: optNum("Enter a number"),
  perCustomerLimit: optNum("Enter a number"),
});

const rupees = (v: number | "" | undefined) => (v === "" || v === undefined ? null : Math.round(v * 100));
const count = (v: number | "" | undefined) => (v === "" || v === undefined ? null : Math.floor(v));
/** <input type="datetime-local"> gives local India time without a zone. */
const istInstant = (v: string | undefined) => (v ? new Date(`${v}:00+05:30`) : null);

export async function saveCouponAction(_prev: CouponState, form: FormData): Promise<CouponState> {
  const staff = await requireStaff();
  if (!can.manageMenu(staff)) return { error: "You do not have permission to do that." };
  const parsed = input.safeParse(Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { error: "Please check the highlighted fields.", fields };
  }
  const d = parsed.data;
  if (d.kind === "percent" && d.value > 100) return { error: "Please check the highlighted fields.", fields: { value: "A percentage can be at most 100" } };
  const startsAt = istInstant(d.startsAt);
  const endsAt = istInstant(d.endsAt);
  if (startsAt && endsAt && endsAt <= startsAt) return { error: "Please check the highlighted fields.", fields: { endsAt: "Must be after the start" } };
  const values = {
    code: d.code,
    description: d.description || null,
    kind: d.kind,
    value: d.kind === "percent" ? Math.round(d.value) : Math.round(d.value * 100),
    minSubtotalPaise: rupees(d.minSubtotal) ?? 0,
    maxDiscountPaise: d.kind === "percent" ? rupees(d.maxDiscount) : null,
    startsAt,
    endsAt,
    usageLimit: count(d.usageLimit),
    perCustomerLimit: count(d.perCustomerLimit),
    firstOrderOnly: form.get("firstOrderOnly") === "on",
    isActive: form.get("isActive") === "on",
  };
  const db = await getDb();
  const id = z.string().uuid().safeParse(form.get("id")).data;
  const [clash] = await db.select({ id: coupons.id }).from(coupons).where(and(eq(coupons.outletId, staff.outletId), eq(coupons.code, d.code)));
  if (clash && clash.id !== id) return { error: "Please check the highlighted fields.", fields: { code: "Another coupon already uses this code" } };
  const [row] = id
    ? await db.update(coupons).set(values).where(and(eq(coupons.id, id), eq(coupons.outletId, staff.outletId))).returning()
    : await db.insert(coupons).values({ ...values, outletId: staff.outletId }).returning();
  await audit(db, { actorId: staff.id, outletId: staff.outletId, action: id ? "coupon.update" : "coupon.create", entity: "coupon", entityId: row.id, data: { code: row.code, active: row.isActive } });
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}
