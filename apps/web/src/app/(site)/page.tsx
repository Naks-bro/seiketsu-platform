import { connection } from "next/server";
import { getMenu, getStore } from "@/lib/server/catalog";
import { Hero } from "@/components/site/home/hero";
import { Manifesto, Marquee, Personality } from "@/components/site/home/bands";
import { BrandPromise, Journey, Story } from "@/components/site/home/story";
import { BuildYourBowl, Categories, Favourites } from "@/components/site/home/menu-sections";
import { FollowTheFresh, Visit } from "@/components/site/home/visit";

export default async function HomePage() {
  await connection();
  const store = await getStore();
  const menu = await getMenu(store.outletId);
  const all = menu.flatMap((c) => c.items);
  const flagged = all.filter((i) => i.isBestseller || i.isFeatured);
  // Until the owner flags favourites, show the first dish of each section.
  const favourites = (flagged.length >= 3 ? flagged : menu.map((c) => c.items[0]).filter(Boolean)).slice(0, 8);
  const extras = all.find((i) => i.addonGroups.length > 0)?.addonGroups ?? [];
  const canOrder = store.isOpenNow && store.paymentsMode !== "disabled" && (store.pickupEnabled || store.deliveryEnabled);

  return (
    <>
      <Hero store={store} />
      <Marquee />
      <Story />
      <Manifesto />
      <Categories menu={menu} />
      <BuildYourBowl groups={extras} />
      <Favourites items={favourites} canOrder={canOrder} />
      <BrandPromise />
      <Journey />
      <Personality />
      <Visit store={store} />
      <FollowTheFresh instagram={store.instagram} />
    </>
  );
}
