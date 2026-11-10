import type { Metadata } from "next";
import { connection } from "next/server";
import { getMenu, getStore } from "@/lib/server/catalog";
import { listPlans } from "@/lib/server/subscriptions";
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

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  await connection();
  const store = await getStore();
  const [menu, plans] = await Promise.all([getMenu(store.outletId), listPlans(store.outletId, true)]);
  const all = menu.flatMap((c) => c.items);
  const flagged = all.filter((i) => i.isBestseller || i.isFeatured);
  // Until the owner flags favourites, show the first dish of each section.
  const picks = flagged.length >= 3 ? flagged : menu.flatMap((c) => c.items.filter((i) => i.imageUrl).slice(0, 2));
  const favourites = [...picks].sort((a, b) => Number(!!b.imageUrl) - Number(!!a.imageUrl)).slice(0, 8);

  return (
    <>
      <div aria-hidden className="scroll-progress pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] bg-butter" />
      <Hero store={store} />
      <Marquee />
      <Lifestyle />
      <WhySeiketsu />
      <ExploreMenu menu={menu} />
      <Favourites items={favourites} />
      <Subscriptions plans={plans.map((p) => ({ slug: p.slug, name: p.name, tagline: p.tagline, pricePaise: p.pricePaise, mealsTotal: p.mealsTotal, durationDays: p.durationDays, deliveryDays: p.deliveryDays, includes: p.includes }))} />
      <HowWeMakeIt />
      <SeiketsuPromise />
      <Plans />
      <Visit store={store} />
      <FollowTheFresh instagram={store.instagram} />
    </>
  );
}
