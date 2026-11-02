import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { getDb, staffRoles, staffUsers } from "@seiketsu/db";
import { env, sessionSecret } from "./env";

const COOKIE = "sk_staff";
const MAX_AGE_SECONDS = 12 * 60 * 60;

export type StaffRole = "owner" | "manager" | "cashier" | "kitchen" | "inventory";
export type Staff = { id: string; email: string; name: string; outletId: string; role: StaffRole };

export const ROLE_LABEL: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  kitchen: "Kitchen",
  inventory: "Inventory",
};

/** Where each role lands after signing in. */
export function homeFor(s: Staff) {
  if (s.role === "kitchen") return "/kitchen";
  if (s.role === "cashier") return "/pos";
  if (s.role === "inventory") return "/admin/inventory";
  return "/admin/orders";
}

export async function startSession(userId: string, sessionVersion: number) {
  const token = await new SignJWT({ v: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(sessionSecret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** Current signed-in staff member, or null. Checked against the DB every request. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let sub: string;
  let v: number;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    sub = payload.sub!;
    v = Number(payload.v);
  } catch {
    return null;
  }
  const db = await getDb();
  const [row] = await db
    .select({ u: staffUsers, r: staffRoles })
    .from(staffUsers)
    .innerJoin(staffRoles, eq(staffRoles.staffUserId, staffUsers.id))
    .where(eq(staffUsers.id, sub))
    .limit(1);
  if (!row || !row.u.isActive || row.u.sessionVersion !== v) return null;
  return { id: row.u.id, email: row.u.email, name: row.u.name, outletId: row.r.outletId, role: row.r.role };
});

/** Use at the top of every admin page and action. */
export async function requireStaff(roles?: StaffRole[]): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  if (roles && !roles.includes(staff.role)) throw new Error("You do not have permission to do that.");
  return staff;
}

/** For pages: sends staff without access to their own home screen instead of showing an error. */
export async function requirePage(allowed: (s: Staff) => boolean): Promise<Staff> {
  const staff = await requireStaff();
  if (!allowed(staff)) redirect(homeFor(staff));
  return staff;
}

/** What each role may do. Owner: everything. Manager: everything except staff and tax. */
export const can = {
  manageOrders: (s: Staff) => ["owner", "manager", "cashier", "kitchen"].includes(s.role),
  kitchen: (s: Staff) => ["owner", "manager", "cashier", "kitchen"].includes(s.role),
  pos: (s: Staff) => ["owner", "manager", "cashier"].includes(s.role),
  reports: (s: Staff) => ["owner", "manager"].includes(s.role),
  manageStaff: (s: Staff) => s.role === "owner",
  messaging: (s: Staff) => ["owner", "manager"].includes(s.role),
  refund: (s: Staff) => ["owner", "manager"].includes(s.role),
  manageMenu: (s: Staff) => ["owner", "manager"].includes(s.role),
  manageSettings: (s: Staff) => ["owner", "manager"].includes(s.role),
  manageTax: (s: Staff) => s.role === "owner",
  /** deliveries, wastage, stock counts, suppliers */
  inventory: (s: Staff) => ["owner", "manager", "inventory"].includes(s.role),
  /** recipes decide food cost, so only owners and managers change them */
  manageRecipes: (s: Staff) => ["owner", "manager"].includes(s.role),
};