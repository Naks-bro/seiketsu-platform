import type { Metadata } from "next";
import { can, requireStaff } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Kitchen | Seiketsu", robots: { index: false } };

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  if (!can.kitchen(staff)) return <p className="p-8">You do not have access to the kitchen screen.</p>;
  return <div className="min-h-dvh bg-[#1d1a17] text-[#f6f0e6]">{children}</div>;
}