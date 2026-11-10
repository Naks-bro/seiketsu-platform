import Image from "next/image";
import Link from "next/link";
import type { CategoryDTO, MenuItemDTO } from "@/lib/types";
import { formatINR, fromPrice } from "@/lib/format";
import { DietMark } from "@/components/diet-mark";
import { itemDiets } from "@seiketsu/core/diet-filter";
import { QuickAdd } from "./client";
import { LANDING_ONLY } from "@/lib/site-mode";

/** A menu tile: a link into the menu, or a plain card when ordering is switched off. */
function TileLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return LANDING_ONLY ? <div className={className}>{children}</div> : <Link href={href} className={className}>{children}</Link>;
}

/** The owner's five menu groups, mapped onto the menu's sections. */
const GROUPS = [
  { title: "Salads", body: "Fresh greens, vibrant vegetables and delicious combinations.", slugs: ["salads"], img: "/landing/salad-bowl-cut.webp", tone: "bg-olive/20" },
  { title: "Wraps & Sandwiches", body: "Wholesome, flavour-packed options for meals on the go.", slugs: ["wraps", "sandwiches"], img: "/art/wrap_halves.webp", tone: "bg-butter" },
  { title: "Nourishing Bowls", body: "A satisfying mix of thoughtfully selected ingredients.", slugs: ["meals", "pasta"], img: "/art/mixed_pasta_bowl.webp", tone: "bg-pink/15" },
  { title: "Fresh-Pressed Juices", body: "Freshly pressed goodness in every sip.", slugs: ["juices"], img: "/landing/juice-bottle-cut.webp", tone: "bg-orange/20" },
  { title: "Smoothies", body: "Refreshing blends made to brighten your day.", slugs: ["smoothies"], img: "/art/chocolate_bottle.webp", tone: "bg-berry/10" },
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
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {tiles.map((t, i) => (
            <li key={t.title} data-reveal style={{ "--d": `${i * 60}ms` } as React.CSSProperties} className={i < 2 ? "lg:col-span-3" : "lg:col-span-2"}>
              <TileLink href={t.href} className={`group relative flex h-56 flex-col lg:h-60 overflow-hidden rounded-[1.75rem] p-5 transition duration-500 hover:-translate-y-1 sm:p-6 ${t.tone}`}>
                <span className="relative z-10 max-w-[75%] font-display text-2xl leading-tight text-ink sm:text-[1.75rem]">{t.title}</span>
                <span className="relative z-10 mt-2 max-w-[60%] text-sm text-ink/70">{t.body}</span>
                <span className="relative z-10 mt-auto text-xs text-ink/70 sm:text-sm">
                  {t.count} {t.count === 1 ? "choice" : "choices"}
                  {t.from != null && <> · from <span className="tabular">{formatINR(t.from)}</span></>}
                </span>
                <span aria-hidden className="absolute -bottom-2 right-0 h-[62%] w-[40%]">
                  <span className="drift-in absolute inset-0">
                    <Image src={t.img} alt="" fill sizes="(min-width: 1024px) 240px, 45vw" className="object-contain object-right-bottom mix-blend-multiply" />
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
        <ul className="no-scrollbar relative -mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {items.map((i) => {
            const kcal = i.variants.map((v) => v.nutrition?.kcal).filter((n): n is number => n != null);
            const protein = i.variants.map((v) => v.nutrition?.proteinG).filter((n): n is number => n != null);
            return (
              <li key={i.id} className="flex w-72 shrink-0 snap-start flex-col rounded-[1.75rem] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-1.5">
                  {[...itemDiets(i)].map((d) => <DietMark key={d} diet={d} />)}
                  {i.isBestseller && <span className="ml-1 text-[11px] font-semibold text-[#a3520f]">★ Bestseller</span>}
                </div>
                {LANDING_ONLY ? (
                  <h3 className="mt-3 font-display text-2xl leading-tight text-ink">{i.name}</h3>
                ) : (
                  <Link href={`/menu#${i.slug}`} className="mt-3 font-display text-2xl leading-tight text-ink hover:text-berry">{i.name}</Link>
                )}
                {i.description && <p className="mt-2 line-clamp-3 text-sm text-muted">{i.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {kcal.length > 0 && <span className="tabular rounded-full bg-olive/10 px-2 py-0.5 font-medium text-olive-ink">{Math.min(...kcal)}{Math.max(...kcal) !== Math.min(...kcal) ? `–${Math.max(...kcal)}` : ""} kcal</span>}
                  {protein.length > 0 && <span className="tabular rounded-full bg-pink/10 px-2 py-0.5 font-medium text-berry">{Math.max(...protein)}g protein</span>}
                </div>
                <div className="mt-auto flex items-center justify-between pt-6">
                  <span className="tabular font-semibold">
                    {new Set(i.variants.map((v) => v.pricePaise)).size > 1 && <span className="text-xs font-normal text-muted">from </span>}
                    {formatINR(fromPrice(i.variants.map((v) => v.pricePaise)))}
                  </span>
                  {!LANDING_ONLY && <QuickAdd item={i} />}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
