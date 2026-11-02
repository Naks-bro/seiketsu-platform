import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { getDb, staffRoles, staffUsers } from "@seiketsu/db";
import { can, requireStaff, ROLE_LABEL } from "@/lib/server/auth";
import { formatDateTime } from "@/lib/format";
import { btnGhost, PageHeader, panel } from "@/components/admin/ui";
import { updateStaffAction } from "../../staff-actions";
import { AddStaffForm } from "./add-staff-form";
import { ResetPassword } from "./reset-password";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const me = await requireStaff();
  if (!can.manageStaff(me)) return <p className="text-muted">Only the owner can manage staff.</p>;
  const db = await getDb();
  const rows = await db
    .select({ u: staffUsers, role: staffRoles.role })
    .from(staffUsers)
    .innerJoin(staffRoles, eq(staffRoles.staffUserId, staffUsers.id))
    .where(eq(staffRoles.outletId, me.outletId))
    .orderBy(asc(staffUsers.name));

  return (
    <div className="space-y-6">
      <PageHeader title="Staff" lede="Give each person their own login, so every action is recorded under their name. Removing someone signs them out at once." />
      <section className={panel}>
        <h2 className="mb-4 font-display text-xl">Add someone</h2>
        <AddStaffForm />
      </section>
      <section className={panel}>
        <h2 className="mb-3 font-display text-xl">Team</h2>
        <ul className="divide-y divide-line">
          {rows.map(({ u, role }) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
              <div className="min-w-48 flex-1">
                <p className="font-medium">
                  {u.name} {u.id === me.id && <span className="text-xs text-muted">(you)</span>}
                  {!u.isActive && <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-xs text-muted">Removed</span>}
                </p>
                <p className="text-sm text-muted">{u.email} · {u.lastLoginAt ? `last signed in ${formatDateTime(u.lastLoginAt)}` : "never signed in"}</p>
              </div>
              <form action={updateStaffAction} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="op" value="role" />
                <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.name}</label>
                <select id={`role-${u.id}`} name="role" defaultValue={role} className="rounded-lg border border-line bg-white px-2 py-2 text-sm">
                  {(["owner", "manager", "cashier", "kitchen", "inventory"] as const).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
                <button type="submit" className={btnGhost}>Change role</button>
              </form>
              <ResetPassword userId={u.id} name={u.name} />
              {u.id !== me.id && (
                <form action={updateStaffAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="op" value={u.isActive ? "deactivate" : "activate"} />
                  <button type="submit" className={`${btnGhost} ${u.isActive ? "text-nonveg" : ""}`}>{u.isActive ? `Remove ${u.name.split(" ")[0]}` : "Restore access"}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}