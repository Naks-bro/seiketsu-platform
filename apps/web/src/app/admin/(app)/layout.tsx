import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/server/auth";
import { logoutAction } from "../actions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Seiketsu admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className="min-h-dvh bg-[#fbf8f2]">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-cream">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/admin/orders" className="font-display text-xl text-berry">seiketsu <span className="text-sm font-sans text-muted">admin</span></Link>
          <nav className="flex gap-1 text-sm font-medium" aria-label="Admin">
            <Link href="/admin/orders" className="rounded-lg px-3 py-1.5 hover:bg-paper">Orders</Link>
            <Link href="/admin/menu" className="rounded-lg px-3 py-1.5 hover:bg-paper">Menu</Link>
            <Link href="/admin/messages" className="rounded-lg px-3 py-1.5 hover:bg-paper">Messages</Link>
            <Link href="/admin/settings" className="rounded-lg px-3 py-1.5 hover:bg-paper">Settings</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{staff.name} · <span className="capitalize">{staff.role}</span></span>
            <form action={logoutAction}>
              <button type="submit" className="rounded-lg px-3 py-1.5 hover:bg-paper">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}