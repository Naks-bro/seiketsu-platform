"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, outlets, staffRoles, staffUsers, type Db } from "@seiketsu/db";
import { hashPassword, verifyPassword } from "@seiketsu/core/password";
import { can, requireStaff, startSession, type StaffRole } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { rateLimit } from "@/lib/server/rate-limit";

export type StaffState = { error?: string; ok?: string } | undefined;

type StaffDb = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

const ROLES = ["owner", "manager", "cashier", "kitchen", "inventory"] as const satisfies readonly StaffRole[];
const password = z.string().min(10, "Passwords need at least 10 characters").max(200);

async function owner() {
  const s = await requireStaff();
  if (!can.manageStaff(s)) throw new Error("Only the owner can manage staff.");
  return s;
}

/** Refuses changes that would leave the outlet without an active owner. */
async function keepsAnOwner(outletId: string, exceptUserId: string, db?: StaffDb) {
  db ??= await getDb();
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(staffRoles)
    .innerJoin(staffUsers, eq(staffUsers.id, staffRoles.staffUserId))
    .where(and(eq(staffRoles.outletId, outletId), eq(staffRoles.role, "owner"), eq(staffUsers.isActive, true), ne(staffUsers.id, exceptUserId)));
  return Number(r?.n ?? 0) > 0;
}

export async function addStaffAction(_prev: StaffState, form: FormData): Promise<StaffState> {
  try {
    const me = await owner();
    const input = z
      .object({
        name: z.string().trim().min(2, "Enter their name").max(80),
        email: z.string().trim().toLowerCase().email("Enter a valid email"),
        role: z.enum(ROLES),
        password,
      })
      .parse(Object.fromEntries(form));
    const db = await getDb();
    const [exists] = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.email, input.email));
    if (exists) return { error: "Someone with that email already has a login." };
    await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(staffUsers)
        .values({ email: input.email, name: input.name, passwordHash: await hashPassword(input.password) })
        .returning();
      await tx.insert(staffRoles).values({ staffUserId: u.id, outletId: me.outletId, role: input.role });
      await audit(tx, { actorId: me.id, outletId: me.outletId, action: "staff.create", entity: "staff", entityId: u.id, data: { email: input.email, role: input.role } });
    });
    revalidatePath("/admin/staff");
    return { ok: `${input.name} can now sign in. Share the password with them privately.` };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Could not add staff." };
  }
}

async function requireAuthorityOverSharedUser(userId: string, ownerId: string, db?: StaffDb) {
  db ??= await getDb();
  const memberships = await db.select().from(staffRoles).where(eq(staffRoles.staffUserId, userId));
  const owned = new Set((await db.select().from(staffRoles).where(and(eq(staffRoles.staffUserId, ownerId), eq(staffRoles.role, "owner")))).map((r) => r.outletId));
  if (memberships.some((r) => !owned.has(r.outletId))) throw new Error("This login is shared with another outlet. Only an owner of all its outlets can change its password or activation.");
  return memberships;
}

export async function updateStaffAction(form: FormData) {
  const me = await owner();
  const { userId, op, role } = z
    .object({ userId: z.string().uuid(), op: z.enum(["role", "deactivate", "activate"]), role: z.enum(ROLES).optional() })
    .refine((v) => v.op !== "role" || !!v.role, { message: "Choose a role" })
    .parse(Object.fromEntries(form));
  const db = await getDb();
  await db.transaction(async (tx) => {
    // Staff role/activation changes are rare; lock outlets in one order to keep last-owner checks atomic.
    await tx.select({ id: outlets.id }).from(outlets).orderBy(asc(outlets.id)).for("update");
    const [link] = await tx.select().from(staffRoles).where(and(eq(staffRoles.staffUserId, userId), eq(staffRoles.outletId, me.outletId)));
    if (!link) throw new Error("Staff member not found.");
    const losingOwner = link.role === "owner" && (op === "deactivate" || (op === "role" && role !== "owner"));
    if (losingOwner && !(await keepsAnOwner(me.outletId, userId, tx))) throw new Error("Keep at least one active owner.");

    if (op === "role" && role) {
      await tx.update(staffRoles).set({ role }).where(and(eq(staffRoles.staffUserId, userId), eq(staffRoles.outletId, me.outletId)));
    } else {
      const memberships = await requireAuthorityOverSharedUser(userId, me.id, tx);
      if (op === "deactivate") {
        for (const link of memberships) if (link.role === "owner" && !(await keepsAnOwner(link.outletId, userId, tx))) throw new Error("Keep at least one active owner in every outlet.");
      }
      // Signing out everywhere on (de)activation.
      await tx
        .update(staffUsers)
        .set({ isActive: op === "activate", sessionVersion: sql`${staffUsers.sessionVersion} + 1` })
        .where(eq(staffUsers.id, userId));
    }
    await audit(tx, { actorId: me.id, outletId: me.outletId, action: `staff.${op}`, entity: "staff", entityId: userId, data: { role: role ?? null } });
  });
  revalidatePath("/admin/staff");
}

export async function resetStaffPasswordAction(_prev: StaffState, form: FormData): Promise<StaffState> {
  try {
    const me = await owner();
    const { userId, password: pw } = z.object({ userId: z.string().uuid(), password }).parse(Object.fromEntries(form));
    const db = await getDb();
    const [link] = await db.select().from(staffRoles).where(and(eq(staffRoles.staffUserId, userId), eq(staffRoles.outletId, me.outletId)));
    if (!link) return { error: "Staff member not found." };
    await requireAuthorityOverSharedUser(userId, me.id);
    await db
      .update(staffUsers)
      .set({ passwordHash: await hashPassword(pw), sessionVersion: sql`${staffUsers.sessionVersion} + 1` })
      .where(eq(staffUsers.id, userId));
    await audit(db, { actorId: me.id, outletId: me.outletId, action: "staff.reset_password", entity: "staff", entityId: userId });
    return { ok: "Password changed. They have been signed out everywhere." };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Could not reset the password." };
  }
}

/** Any staff member changing their own password. */
export async function changeOwnPasswordAction(_prev: StaffState, form: FormData): Promise<StaffState> {
  try {
    const me = await requireStaff();
    if (!(await rateLimit(`pw-change:${me.id}`, 5, 900))) return { error: "Too many attempts. Wait 15 minutes." };
    const input = z
      .object({ current: z.string().min(1, "Enter your current password"), next: password, confirm: z.string() })
      .refine((v) => v.next === v.confirm, { message: "The new passwords do not match", path: ["confirm"] })
      .parse(Object.fromEntries(form));
    const db = await getDb();
    const [u] = await db.select().from(staffUsers).where(eq(staffUsers.id, me.id));
    if (!u || !(await verifyPassword(input.current, u.passwordHash))) return { error: "Your current password is not right." };
    const [updated] = await db
      .update(staffUsers)
      .set({ passwordHash: await hashPassword(input.next), sessionVersion: sql`${staffUsers.sessionVersion} + 1` })
      .where(eq(staffUsers.id, me.id))
      .returning();
    // Other devices are signed out; this one gets a fresh session.
    await startSession(updated.id, updated.sessionVersion);
    await audit(db, { actorId: me.id, outletId: me.outletId, action: "staff.change_password", entity: "staff", entityId: me.id });
    return { ok: "Password changed. Other devices have been signed out." };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: "Could not change the password." };
  }
}