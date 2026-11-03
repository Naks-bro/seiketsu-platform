import Image from "next/image";
import Link from "next/link";
import type { AddonGroupDTO, CategoryDTO, MenuItemDTO } from "@/lib/types";
import { formatINR, fromPrice } from "@/lib/format";
import { DietMark } from "@/components/diet-mark";
import { itemDiets } from "@seiketsu/core/diet-filter";
import { AddonIconMark } from "../addon-icons";
import { QuickAdd } from "./client";
import { Bowl } from "./doodles";

/** Owner-supplied brand art per category; categories without art get a drawn bowl. */
const CATEGORY_ART: Record<string, string> = {
  wraps: "/art/grilled_wrap.webp",
  sandwiches: "/art/sandwich_on_plate.webp",
  pasta: "/art/green_pasta_bowl.webp",
  meals: "/art/mixed_pasta_bowl.webp",
  juices: "/art/red_juice_bottle.webp",
  smoothies: "/art/chocolate_bottle.webp",
};
const TONES = ["bg-butter", "bg-pink/20", "bg-olive/20", "bg-orange/20", "bg-paper", "bg-berry/10", "bg-butter/60"];

export function Categories({ menu }: { menu: CategoryDTO[] }) {
  return (
    <section className="bg-cream" aria-labelledby="cat-h">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="cat-h" data-reveal className="max-w-2xl font-display text-4xl leading-[1.04] text-ink sm:text-5xl">
            Whatever you’re in the mood for, there’s something at <em className="italic text-berry">Seiketsu.</em>
          </h2>
          <Link href="/menu" className="font-semibold text-berry hover:underline">See the full menu →</Link>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {menu.map((c, i) => (
            <li key={c.id} data-reveal style={{ "--d": `${i * 60}ms` } as React.CSSProperties}>
              <Link href={`/menu#${c.slug}`} className={`group flex aspect-[4/5] flex-col lg:aspect-[5/4] overflow-hidden rounded-[1.75rem] p-4 transition duration-500 hover:-translate-y-1 sm:p-5 ${TONES[i % TONES.length]}`}>
                <span className="font-display text-xl leading-tight text-ink sm:text-3xl">{c.name}</span>
                <span aria-hidden className="relative my-2 flex-1 transition duration-700 group-hover:scale-110 group-hover:-rotate-3">
                  {CATEGORY_ART[c.slug] ? (
                    <Image src={CATEGORY_ART[c.slug]} alt="" fill sizes="(min-width: 1024px) 260px, 45vw" className="object-contain mix-blend-multiply" />
                  ) : (
                    <Bowl className="absolute inset-0 size-full" />
                  )}
                </span>
                <span className="text-xs text-ink/70 sm:text-sm">
                  {c.items.length} {c.items.length === 1 ? "choice" : "choices"} · from <span className="tabular">{formatINR(fromPrice(c.items.flatMap((x) => x.variants.map((v) => v.pricePaise))))}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Favourites({ items, canOrder }: { items: MenuItemDTO[]; canOrder: boolean }) {
  if (!items.length) return null;
  return (
    <section className="overflow-hidden bg-paper" aria-labelledby="fav-h">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive-ink">Worth returning for</p>
        <h2 id="fav-h" data-reveal className="mt-2 font-display text-5xl leading-none text-ink sm:text-6xl">Crowd favourites</h2>
        <ul className="no-scrollbar relative -mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {items.map((i) => {
            const kcal = i.variants.map((v) => v.nutrition?.kcal).filter((n): n is number => n != null);
            const protein = i.variants.map((v) => v.nutrition?.proteinG).filter((n): n is number => n != null);
            return (
              <li key={i.id} className="flex w-72 shrink-0 snap-start flex-col rounded-[1.75rem] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-1.5">
                  {[...itemDiets(i)].map((d) => <DietMark key={d} diet={d} />)}
                  {i.isBestseller && <span className="ml-1 text-[11px] font-semibold uppercase tracking-wide text-[#a3520f]">★ Bestseller</span>}
                </div>
                <Link href={`/menu#${i.slug}`} className="mt-3 font-display text-2xl leading-tight text-ink hover:text-berry">{i.name}</Link>
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
                  <QuickAdd item={i} canOrder={canOrder} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function BuildYourBowl({ groups }: { groups: AddonGroupDTO[] }) {
  if (!groups.length) return null;
  return (
    <section className="bg-berry text-cream" aria-labelledby="build-h">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 md:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-butter">Your bowl, your way</p>
          <h2 id="build-h" data-reveal className="font-display text-5xl leading-[1.02] sm:text-6xl">
            Customise <em className="italic text-butter">every</em> bite.
          </h2>
          <p data-reveal className="max-w-md text-lg text-cream/80">
            Pick your size, then stack it up. Every salad, wrap, meal, sandwich and pasta can take extras from our shelves.
          </p>
          <Link href="/menu" className="inline-flex items-center gap-2 rounded-full bg-cream px-7 py-4 font-semibold text-berry transition hover:-translate-y-0.5 hover:bg-butter">
            Build yours →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g, gi) => (
            <div key={g.id} data-reveal style={{ "--d": `${gi * 90}ms` } as React.CSSProperties} className="rounded-[1.5rem] bg-cream/10 p-5 ring-1 ring-cream/15 backdrop-blur">
              <p className="font-display text-2xl">{g.name}</p>
              <ul className="mt-3 space-y-2">
                {g.addons.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 text-sm">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cream text-berry">
                      <AddonIconMark icon={a.icon} className="size-5" />
                    </span>
                    <span className="flex-1">{a.name}</span>
                    <span className="tabular text-cream/70">+{formatINR(a.pricePaise)}</span>
                  </li>
                ))}
                {g.addons.length > 4 && <li className="pl-12 text-xs text-cream/60">+{g.addons.length - 4} more</li>}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
