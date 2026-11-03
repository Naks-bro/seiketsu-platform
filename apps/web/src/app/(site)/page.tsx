import { connection } from "next/server";
import { getMenu, getStore } from "@/lib/server/catalog";
import { Hero } from "@/components/site/home/hero";
import { Marquee } from "@/components/site/home/bands";
import { Lifestyle } from "@/components/site/home/lifestyle";
import { WhySeiketsu } from "@/components/site/home/why";
import { ExploreMenu, Favourites } from "@/components/site/home/menu-sections";
import { Subscriptions } from "@/components/site/home/subscriptions";
import { HowWeMakeIt } from "@/components/site/home/how";
import { SeiketsuPromise } from "@/components/site/home/promise";
import { Plans } from "@/components/site/home/plans";
import { FollowTheFresh, Visit } from "@/components/site/home/visit";

export default async function HomePage() {
  await connection();
  const store = await getStore();
  const menu = await getMenu(store.outletId);
  const all = menu.flatMap((c) => c.items);
  const flagged = all.filter((i) => i.isBestseller || i.isFeatured);
  // Until the owner flags favourites, show the first dish of each section.
  const favourites = (flagged.length >= 3 ? flagged : menu.map((c) => c.items[0]).filter(Boolean)).slice(0, 8);
  const canOrder = store.isOpenNow && store.paymentsMode !== "disabled" && (store.pickupEnabled || store.deliveryEnabled);

  return (
    <>
      <Hero store={store} />
      <Marquee />
      <Lifestyle />
      <WhySeiketsu />
      <ExploreMenu menu={menu} />
      <Favourites items={favourites} canOrder={canOrder} />
      <Subscriptions />
      <HowWeMakeIt />
      <SeiketsuPromise />
      <Plans />
      <Visit store={store} />
      <FollowTheFresh instagram={store.instagram} />
    </>
  );
}
