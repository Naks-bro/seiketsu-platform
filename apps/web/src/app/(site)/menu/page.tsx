import type { Metadata } from "next";
import { connection } from "next/server";
import { getMenu, getStore } from "@/lib/server/catalog";
import { MenuBrowser } from "@/components/site/menu/menu-browser";
import { env } from "@/lib/server/env";
import { ldJson, menuJsonLd } from "@/lib/seo";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Menu",
  description: "Salads, wraps, meals, sandwiches, pasta, juices and smoothies with nutrition for every option.",
  alternates: { canonical: "/menu" },
};

export default async function MenuPage() {
  await connection();
  const store = await getStore();
  const menu = await getMenu(store.outletId);
  const canOrder = store.isOpenNow && store.paymentsMode !== "disabled" && (store.pickupEnabled || store.deliveryEnabled);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-olive-ink">Made fresh to order</p>
          <h1 className="font-display text-5xl leading-none text-berry sm:text-6xl">The menu</h1>
        </div>
        <p className="max-w-sm text-sm text-muted">
          Tap ADD to drop a dish in your cart. Bowls and salads open so you can pick a size and stack extras. Nutrition is listed for every option.
          <span className="mt-1 block text-xs">{LEGAL.fssaiLabel} {LEGAL.fssai}</span>
        </p>
      </header>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(menuJsonLd(menu, env.siteUrl)) }} />
      <MenuBrowser menu={menu} canOrder={canOrder} whatsapp={store.whatsapp} />
    </div>
  );
}