"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { itemDiets } from "@seiketsu/core/diet-filter";
import type { Diet, MenuItemDTO } from "@/lib/types";
import { formatINR, fromPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { requestLocation } from "@/lib/location";
import { DietMark } from "@/components/diet-mark";
import { flyToCart } from "../fly-to-cart";
import { showToast } from "../toast";
import { cartLineFor, isSimple } from "./cart-line";
import { DishArt } from "./dish-art";

const range = (ns: number[], unit: string) =>
  ns.length === 0 ? null : Math.min(...ns) === Math.max(...ns) ? `${ns[0]}${unit}` : `${Math.min(...ns)}–${Math.max(...ns)}${unit}`;

/** Swiggy-style row: details on the left, picture and ADD on the right. */
export function DishRow({ item, onCustomise, onlyDiet = null }: { item: MenuItemDTO; onCustomise: () => void; onlyDiet?: Diet | null }) {
  const { lines, add, setQuantity, setDrawerOpen } = useCart();
  const [more, setMore] = useState(false);
  const btn = useRef<HTMLDivElement>(null);
  const mine = lines.filter((l) => l.menuItemId === item.id);
  const inCart = mine.reduce((s, l) => s + l.quantity, 0);
  const simple = isSimple(item);
  const prices = item.variants.map((v) => v.pricePaise);
  const kcal = range(item.variants.map((v) => v.nutrition?.kcal).filter((n): n is number => n != null), " kcal");
  const protein = range(item.variants.map((v) => v.nutrition?.proteinG).filter((n): n is number => n != null), "g protein");

  async function onAdd() {
    if (!(await requestLocation())) return;
    if (!simple) return onCustomise();
    add(cartLineFor(item, item.variants[0], [], 1));
    flyToCart(btn.current, item.imageUrl);
    showToast({ title: `Added ${item.name}` });
  }

  function onMinus() {
    if (mine.length === 1) setQuantity(mine[0].key, mine[0].quantity - 1);
    else setDrawerOpen(true);
  }

  return (
    <article className="flex gap-4 py-6 sm:gap-6" aria-labelledby={`d-${item.id}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {[...itemDiets(item)].filter((d) => !onlyDiet || d === onlyDiet).map((d) => (
            <DietMark key={d} diet={d} size={15} />
          ))}
          {item.isBestseller && (
            <span className="ml-1 rounded-md bg-orange/15 px-1.5 py-0.5 text-[11px] font-semibold text-[#a3520f]">★ Bestseller</span>
          )}
          {!item.isBestseller && item.isFeatured && (
            <span className="ml-1 rounded-md bg-butter px-1.5 py-0.5 text-[11px] font-semibold text-berry">Chef&apos;s pick</span>
          )}
        </div>
        <h3 id={`d-${item.id}`} className="mt-1.5 font-display text-xl leading-snug text-ink sm:text-2xl">
          <button type="button" onClick={onCustomise} className="text-left hover:text-berry">{item.name}</button>
        </h3>
        <p className="tabular mt-1 font-semibold">
          {new Set(prices).size > 1 && <span className="text-sm font-normal text-muted">from </span>}
          {formatINR(fromPrice(prices))}
        </p>
        {(kcal || protein) && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {kcal && <span className="tabular rounded-full bg-olive/10 px-2 py-0.5 font-medium text-olive-ink">{kcal}</span>}
            {protein && <span className="tabular rounded-full bg-pink/10 px-2 py-0.5 font-medium text-berry">{protein}</span>}
          </div>
        )}
        {item.description && (
          <p className={`mt-2 text-sm leading-relaxed text-muted ${more ? "" : "line-clamp-2"}`}>
            {item.description}
          </p>
        )}
        {item.description && item.description.length > 110 && (
          <button type="button" onClick={() => setMore((m) => !m)} className="-my-2 py-2 pr-4 text-xs font-semibold text-ink hover:text-berry" aria-expanded={more}>
            {more ? "less" : "more"}
          </button>
        )}
      </div>

      <div className="relative flex w-32 shrink-0 flex-col items-center sm:w-40">
        <button type="button" onClick={onCustomise} className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-paper" aria-label={`View ${item.name}`}>
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt="" fill sizes="160px" className="object-cover" unoptimized />
          ) : (
            <DishArt category={item.categorySlug} seed={item.name} />
          )}
        </button>
        <div ref={btn} className="relative z-10 -mt-5 w-[84%]">
          {inCart > 0 ? (
            <div className="flex h-10 items-center justify-between overflow-hidden rounded-xl border border-berry/20 bg-white text-berry shadow-[var(--shadow-card)]" role="group" aria-label={`${item.name}: ${inCart} in cart`}>
              <button type="button" onClick={onMinus} className="h-full w-10 text-xl font-semibold hover:bg-paper" aria-label={`Remove one ${item.name}`}>−</button>
              <span className="tabular font-bold" aria-live="polite">{inCart}</span>
              <button type="button" onClick={onAdd} className="h-full w-10 text-xl font-semibold hover:bg-paper" aria-label={`Add another ${item.name}`}>+</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="h-10 w-full rounded-xl border border-berry/20 bg-white text-sm font-extrabold tracking-wider text-berry shadow-[var(--shadow-card)] transition hover:bg-berry hover:text-cream active:scale-95"
              aria-label={`Add ${item.name}`}
            >
              ADD
            </button>
          )}
        </div>
        {!simple && <span className="mt-1.5 text-[11px] text-muted">customisable</span>}
      </div>
    </article>
  );
}
