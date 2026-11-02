import { connection } from "next/server";
import { requireStaff } from "@/lib/server/auth";
import { activeTickets } from "@/lib/server/active-orders";
import { getStore } from "@/lib/server/catalog";
import { KitchenBoard } from "./board";

export default async function KitchenPage() {
  await connection();
  const staff = await requireStaff();
  const [tickets, store] = await Promise.all([activeTickets(staff.outletId), getStore()]);
  return <KitchenBoard tickets={tickets} outletId={staff.outletId} prepMinutes={store.prepTimeMinutes} staffName={staff.name} />;
}