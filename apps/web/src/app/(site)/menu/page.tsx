import type { Metadata } from "next";
import { connection } from "next/server";
import { getMenu, getStore } from "@/lib/server/catalog";
import { MenuBrowser } from "@/components/site/menu-browser";

export const metadata: Metadata = {
  title: "Menu",
  description: "Salads, wraps, meals, sandwiches, pasta, juices and smoothies with nutrition for every option.",
};

export default async function MenuPage() {
  await connection();
  const store = await getStore();
  const menu = await getMenu(store.outletId);
  const canOrder = store.isOpenNow && store.paymentsMode !== "disabled" && (store.pickupEnabled || store.deliveryEnabled);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <header className="mb-6 space-y-2">
        <h1 className="font-display text-4xl text-berry sm:text-5xl">Menu</h1>
        <p className="max-w-xl text-muted">
          Every dish is made fresh to order. Tap a dish to choose a size or protein, add extras and see its nutrition.
        </p>
      </header>
      <MenuBrowser menu={menu} canOrder={canOrder} whatsapp={store.whatsapp} />
    </div>
  );
}