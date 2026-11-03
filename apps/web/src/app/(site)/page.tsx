import { connection } from "next/server";
import { getMenu, getStore } from "@/lib/server/catalog";
import { Hero } from "@/components/site/home/hero";
import { Manifesto, Marquee } from "@/components/site/home/bands";
import { NutritionSpotlight, type Spotlight } from "@/components/site/home/nutrition";
import { Journey, Story } from "@/components/site/home/story";
import { BrandPromise } from "@/components/site/home/promise";
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
  // The highest-protein dish from each of four sections, using the option (e.g. Chicken, Large) that has it.
  const spotlight: Spotlight[] = all
    .flatMap((i) =>
      i.variants
        .filter((v) => v.nutrition)
        .map((v) => ({ section: i.categorySlug, slug: i.slug, name: i.name, option: [v.label, v.portion].filter(Boolean).join(" · ") || null, pricePaise: v.pricePaise, ...v.nutrition! })),
    )
    .sort((a, b) => b.proteinG - a.proteinG)
    .filter((d, i, arr) => arr.findIndex((x) => x.section === d.section) === i)
    .slice(0, 4);
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
      <NutritionSpotlight dishes={spotlight} />
      <Visit store={store} />
      <FollowTheFresh instagram={store.instagram} />
    </>
  );
}
