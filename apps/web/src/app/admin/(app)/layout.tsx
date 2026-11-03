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
  if (can.manageSettings(s)) items.push({ href: "/admin/delivery-areas", label: "Delivery areas" });
  if (can.manageSettings(s)) items.push({ href: "/admin/area-requests", label: "Area requests" });
  if (can.manageSettings(s)) items.push({ href: "/admin/settings", label: "Settings" });
  return items;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className="min-h-dvh bg-[#fbf8f2] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <AdminNav
        items={navFor(staff)}
        homeHref={homeFor(staff)}
        account={
          <Link href="/admin/account" className="block rounded-xl px-3 py-1.5 hover:bg-paper">
            <span className="block font-medium">{staff.name}</span>
            <span className="text-xs text-muted">{ROLE_LABEL[staff.role]} · Your account</span>
          </Link>
        }
        signOut={
          <form action={logoutAction}>
            <button type="submit" className="w-full rounded-xl px-3 py-1.5 text-left text-muted hover:bg-paper hover:text-ink">Sign out</button>
          </form>
        }
      />
      <main id="main" className="min-w-0 px-4 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}