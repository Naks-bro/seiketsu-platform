import { connection } from "next/server";
import { requireStaff } from "@/lib/server/auth";
import { getMenu, getStore } from "@/lib/server/catalog";
import { PosScreen } from "./pos-screen";

export default async function PosPage() {
  await connection();
  const staff = await requireStaff();
  const store = await getStore();
  const menu = await getMenu(store.outletId);
  return <PosScreen menu={menu} pricing={store.pricing} staffName={staff.name} />;
}