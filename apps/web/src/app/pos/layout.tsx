import type { Metadata } from "next";
import { can, requireStaff } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Counter | Seiketsu", robots: { index: false } };

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  if (!can.pos(staff)) return <p className="p-8">You do not have access to the counter.</p>;
  return <div className="min-h-dvh bg-[#fbf8f2]">{children}</div>;
}