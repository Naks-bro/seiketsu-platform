import type { Metadata } from "next";
import { can, requirePage } from "@/lib/server/auth";
import { InventoryTabs } from "./tabs";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  await requirePage(can.inventory);
  return (
    <div className="space-y-6">
      <InventoryTabs />
      {children}
    </div>
  );
}
