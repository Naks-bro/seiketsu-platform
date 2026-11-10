import Image from "next/image";
import Link from "next/link";
import type { CategoryDTO, MenuItemDTO } from "@/lib/types";
import { formatINR, fromPrice } from "@/lib/format";
import { DietMark } from "@/components/diet-mark";
import { itemDiets } from "@seiketsu/core/diet-filter";
import { QuickAdd } from "./client";
import { DishArt } from "@/components/site/menu/dish-art";
import { LANDING_ONLY } from "@/lib/site-mode";

/** A menu tile: a link into the menu, or a plain card when ordering is switched off. */
function TileLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return LANDING_ONLY ? <div className={className}>{children}</div> : <Link href={href} className={className}>{children}</Link>;
}

/** The owner's five menu groups, mapped onto the menu's sections. */
const GROUPS = [
  { title: "Salads", body: "Fresh greens, vibrant vegetables and delicious combinations.", slugs: ["salads"], img: "/menu/mediterranean-salad-bowl.webp", tone: "bg-olive/20" },
  { title: "Wraps & Sandwiches", body: "Wholesome, flavour-packed options for meals on the go.", slugs: ["wraps", "sandwiches"], img: "/menu/tandoori-grill.webp", tone: "bg-butter" },
  { title: "Nourishing Bowls", body: "A satisfying mix of thoughtfully selected ingredients.", slugs: ["meals", "pasta"], img: "/menu/chicken-shawarma-meal-bowl.webp", tone: "bg-pink/15" },
  { title: "Fresh-Pressed Juices", body: "Freshly pressed goodness in every sip.", slugs: ["juices"], img: "/menu/sunrise-kick.webp", tone: "bg-orange/20" },
  { title: "Smoothies", body: "Refreshing blends made to brighten your day.", slugs: ["smoothies"], img: "/menu/chocolate-smoothie.webp", tone: "bg-berry/10" },
];

export function ExploreMenu({ menu }: { menu: CategoryDTO[] }) {
  const tiles = GROUPS.map((g) => {
    const cats = menu.filter((c) => g.slugs.includes(c.slug) && c.items.length > 0);
    const items = cats.flatMap((c) => c.items);
    return { ...g, href: cats[0] ? `/menu#${cats[0].slug}` : "/menu", count: items.length, from: items.length ? fromPrice(items.flatMap((x) => x.variants.map((v) => v.pricePaise))) : null };
  }).filter((t) => t.count > 0);

  return (
    <section id="explore" className="scroll-mt-20 bg-cream" aria-labelledby="explore-h">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-olive-ink">Explore the menu</p>
            <h2 id="explore-h" data-reveal className="mt-2 font-display text-4xl leading-[1.04] text-ink sm:text-5xl">
              Something Fresh for Every <em className="italic text-berry">Craving.</em>
            </h2>
            <p data-reveal className="mt-3 text-ink/70">
              From light bites to satisfying meals and refreshing drinks, there’s always something good waiting for you.
            </p>
          </div>
          {!LANDING_ONLY && (
            <Link href="/menu" className="rounded-full bg-berry px-6 py-3 text-sm font-semibold text-cream transition hover:bg-berry-deep">
              View full menu
            </Link>
          )}
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {tiles.map((t, i) => (
            <li key={t.title} data-reveal style={{ "--d": `${i * 60}ms` } as React.CSSProperties} className={i === 0 ? "col-span-2 lg:col-span-1" : ""}>
              <TileLink href={t.href} className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[var(--shadow-card)] transition duration-500 hover:-translate-y-1">
                <span className={`relative block overflow-hidden bg-berry ${i === 0 ? "aspect-[2/1] lg:aspect-square" : "aspect-square"}`}>
                  <Image src={t.img} alt="" fill sizes="(min-width: 1024px) 220px, (min-width: 640px) 45vw, 90vw" className="object-cover" />
                </span>
                <span className={`flex flex-1 flex-col p-4 sm:p-5 ${t.tone}`}>
                  <span className="font-display text-xl leading-tight text-ink sm:text-2xl">{t.title}</span>
                  <span className="mt-1.5 text-sm text-ink/70">{t.body}</span>
                  <span className="mt-auto pt-3 text-xs text-ink/70 sm:text-sm">
                    {t.count} {t.count === 1 ? "choice" : "choices"}
                    {t.from != null && <>, from <span className="tabular">{formatINR(t.from)}</span></>}
                  </span>
                </span>
              </TileLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Favourites({ items }: { items: MenuItemDTO[] }) {
  if (!items.length) return null;
  return (
    <section id="favourites" className="scroll-mt-20 overflow-hidden bg-paper" aria-labelledby="fav-h">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="fav-h" data-reveal className="font-display text-4xl leading-none text-ink sm:text-5xl">
            Find your <em className="italic text-berry">favourite.</em>
          </h2>
          {!LANDING_ONLY && <Link href="/menu" className="font-semibold text-berry hover:underline">View full menu</Link>}
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {items.map((i) => {
            const kcal = i.variants.map((v) => v.nutrition?.kcal).filter((n): n is number => n != null);
            const protein = i.variants.map((v) => v.nutrition?.proteinG).filter((n): n is number => n != null);
            return (
              <li key={i.id} data-reveal style={{ "--d": `${(items.indexOf(i) % 4) * 70}ms` } as React.CSSProperties} className="flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] border border-line bg-white shadow-[var(--shadow-card)] sm:rounded-[1.75rem]">
                <div className="relative aspect-square overflow-hidden bg-berry sm:aspect-[4/3]">
                  {i.imageUrl ? (
                    <Image src={i.imageUrl} alt={i.name} fill sizes="(min-width: 1024px) 270px, 50vw" className="object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center bg-paper"><DishArt category={i.categorySlug} seed={i.name} size="lg" /></div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3.5 sm:p-6 sm:pt-5">
                <div className="flex items-center gap-1.5">
                  {[...itemDiets(i)].map((d) => <DietMark key={d} diet={d} />)}
                  {i.isBestseller && <span className="ml-1 text-[11px] font-semibold text-[#a3520f]">★ Bestseller</span>}
                </div>
                {LANDING_ONLY ? (
                  <h3 className="mt-2 font-display text-lg leading-tight text-ink sm:mt-3 sm:text-2xl">{i.name}</h3>
                ) : (
                  <Link href={`/menu#${i.slug}`} className="mt-2 font-display text-lg leading-tight text-ink hover:text-berry sm:mt-3 sm:text-2xl">{i.name}</Link>
                )}
                {i.description && <p className="mt-2 line-clamp-3 hidden text-sm text-muted sm:block">{i.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {kcal.length > 0 && <span className="tabular rounded-full bg-olive/10 px-2 py-0.5 font-medium text-olive-ink">{Math.min(...kcal)}{Math.max(...kcal) !== Math.min(...kcal) ? `–${Math.max(...kcal)}` : ""} kcal</span>}
                  {protein.length > 0 && <span className="tabular rounded-full bg-pink/10 px-2 py-0.5 font-medium text-berry">{Math.max(...protein)}g protein</span>}
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 sm:pt-6">
                  <span className="tabular font-semibold">
                    {new Set(i.variants.map((v) => v.pricePaise)).size > 1 && <span className="text-xs font-normal text-muted">from </span>}
                    {formatINR(fromPrice(i.variants.map((v) => v.pricePaise)))}
                  </span>
                  {!LANDING_ONLY && <QuickAdd item={i} />}
                </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
