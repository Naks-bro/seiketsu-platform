import type { Metadata } from "next";
import Link from "next/link";
import { can, homeFor, requireStaff, ROLE_LABEL, type Staff } from "@/lib/server/auth";
import { logoutAction } from "../actions";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Seiketsu admin" }, robots: { index: false } };

function navFor(s: Staff) {
  const items: { href: string; label: string }[] = [];
  if (can.manageOrders(s)) items.push({ href: "/admin/orders", label: "Orders" });
  if (can.kitchen(s)) items.push({ href: "/kitchen", label: "Kitchen" });
  if (can.pos(s)) items.push({ href: "/pos", label: "Counter" });
  if (can.manageOrders(s)) items.push({ href: "/admin/menu", label: "Menu" });
  if (can.inventory(s)) items.push({ href: "/admin/inventory", label: "Inventory" });
  if (can.reports(s)) items.push({ href: "/admin/reports", label: "Reports" });
  if (can.messaging(s)) items.push({ href: "/admin/messages", label: "Messages" });
  if (can.manageStaff(s)) items.push({ href: "/admin/staff", label: "Staff" });
  if (can.manageSettings(s)) items.push({ href: "/admin/enquiries", label: "Enquiries" });
  if (can.manageSettings(s)) items.push({ href: "/admin/area-requests", label: "Area requests" });
  if (can.manageSettings(s)) items.push({ href: "/admin/settings", label: "Settings" });
  return items;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className="min-h-dvh bg-[#fbf8f2]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <header className="no-print sticky top-0 z-30 border-b border-line bg-cream">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
          <Link href={homeFor(staff)} className="font-display text-xl text-berry">seiketsu <span className="font-sans text-sm text-muted">admin</span></Link>
          <AdminNav items={navFor(staff)} />
          <div className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/admin/account" className="rounded-lg px-3 py-2 hover:bg-paper">
              {staff.name.split(" ")[0]} <span className="text-muted">· {ROLE_LABEL[staff.role]}</span>
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="rounded-lg px-3 py-2 hover:bg-paper">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}