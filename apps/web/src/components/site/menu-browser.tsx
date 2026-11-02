"use client";

import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CategoryDTO, Diet, MenuItemDTO } from "@/lib/types";
import { formatINR, fromPrice, whatsappLink } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { DietMark } from "@/components/diet-mark";
import { ItemSheet } from "./item-sheet";

type DietFilter = "all" | Diet;

const readHash = () => decodeURIComponent(window.location.hash.slice(1));
function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function itemDiets(item: MenuItemDTO): Set<Diet> {
  const s = new Set<Diet>();
  if (item.diet) s.add(item.diet);
  for (const v of item.variants) if (v.diet) s.add(v.diet);
  return s;
}

export function MenuBrowser({ menu, canOrder, whatsapp }: { menu: CategoryDTO[]; canOrder: boolean; whatsapp: string | null }) {
  const { reconcile } = useCart();
  const [query, setQuery] = useState("");
  const [diet, setDiet] = useState<DietFilter>("all");
  const [picked, setPicked] = useState<MenuItemDTO | null>(null);
  const [closedHash, setClosedHash] = useState<string | null>(null);
  const q = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    reconcile(menu);
  }, [menu, reconcile]);

  // Deep link: /menu#item-slug opens that dish.
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const hashItem = hash && hash !== closedHash ? menu.flatMap((c) => c.items).find((i) => i.slug === hash) : undefined;
  const open = picked ?? hashItem ?? null;
  const close = () => {
    setPicked(null);
    setClosedHash(hash);
  };

  const filtered = useMemo(
    () =>
      menu
        .map((c) => ({
          ...c,
          items: c.items.filter((i) => {
            if (diet !== "all" && !itemDiets(i).has(diet)) return false;
            if (!q) return true;
            return `${i.name} ${i.description ?? ""} ${c.name}`.toLowerCase().includes(q);
          }),
        }))
        .filter((c) => c.items.length > 0),
    [menu, q, diet],
  );

  const wa = whatsappLink(whatsapp, "Hi Seiketsu! I would like to place an order.");

  return (
    <>
      <div className="sticky top-16 z-20 -mx-4 space-y-3 border-b border-line bg-cream/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-56">
            <span className="sr-only">Search the menu</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes or ingredients"
              className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-berry"
            />
          </label>
          <div className="flex gap-1 rounded-full border border-line bg-white p-1 text-sm" role="radiogroup" aria-label="Filter by diet">
            {(
              [
                ["all", "All"],
                ["veg", "Veg"],
                ["egg", "Egg"],
                ["non_veg", "Non-veg"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={diet === value}
                onClick={() => setDiet(value)}
                className={`rounded-full px-3 py-1.5 font-medium ${diet === value ? "bg-berry text-cream" : "text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <nav aria-label="Categories" className="-mx-1 flex gap-1 overflow-x-auto pb-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filtered.map((c) => (
            <a key={c.id} href={`#${c.slug}`} className="shrink-0 rounded-full px-3 py-1.5 font-medium text-muted hover:bg-paper hover:text-berry">
              {c.name}
            </a>
          ))}
        </nav>
      </div>

      {diet !== "all" && (
        <p className="mt-4 text-xs text-muted">
          Diet marks appear only where the menu states them. Dishes without a mark are not filtered as veg; ask us if unsure.
        </p>
      )}

      {!canOrder && (
        <div className="mt-6 rounded-2xl bg-butter/60 p-4 text-sm">
          Online ordering is closed right now. You can still browse the menu
          {wa ? (
            <>
              {" "}or{" "}
              <a href={wa} target="_blank" rel="noreferrer" className="font-semibold text-berry underline">
                message us on WhatsApp
              </a>
            </>
          ) : null}
          .
        </div>
      )}

      {filtered.length === 0 && <p className="py-16 text-center text-muted">Nothing matches that search. Try another word.</p>}

      {filtered.map((c) => (
        <section key={c.id} id={c.slug} className="pt-10" aria-labelledby={`h-${c.slug}`}>
          <h2 id={`h-${c.slug}`} className="mb-4 font-display text-3xl text-ink">{c.name}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {c.items.map((item) => (
              <li key={item.id} id={item.slug}>
                <MenuCard item={item} onOpen={() => setPicked(item)} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {open && <ItemSheet key={open.id} item={open} canOrder={canOrder} onClose={close} />}
    </>
  );
}

function MenuCard({ item, onOpen }: { item: MenuItemDTO; onOpen: () => void }) {
  const prices = item.variants.map((v) => v.pricePaise);
  const multi = new Set(prices).size > 1;
  const kcal = item.variants.map((v) => v.nutrition?.kcal).filter((n): n is number => n != null);
  const protein = item.variants.map((v) => v.nutrition?.proteinG).filter((n): n is number => n != null);
  const diets = [...itemDiets(item)];
  const range = (ns: number[], unit: string) =>
    ns.length === 0 ? null : Math.min(...ns) === Math.max(...ns) ? `${ns[0]}${unit}` : `${Math.min(...ns)}–${Math.max(...ns)}${unit}`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full flex-col gap-3 rounded-2xl border border-line bg-white/60 p-5 text-left transition hover:border-berry/40 hover:bg-white hover:shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-start gap-3">
        <div className="flex gap-1 pt-1.5">
          {diets.map((d) => (
            <DietMark key={d} diet={d} />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl leading-tight">{item.name}</h3>
          {(item.isBestseller || item.isFeatured) && (
            <span className="mt-1 inline-block rounded-full bg-butter px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-berry">
              {item.isBestseller ? "Bestseller" : "Featured"}
            </span>
          )}
        </div>
        <span className="tabular shrink-0 font-semibold text-berry">
          {multi && <span className="text-xs font-normal text-muted">from </span>}
          {formatINR(fromPrice(prices))}
        </span>
      </div>
      {item.description && <p className="line-clamp-2 text-sm leading-relaxed text-muted">{item.description}</p>}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-olive-ink">
        {range(kcal, " kcal") && <span className="tabular">{range(kcal, " kcal")}</span>}
        {range(protein, " g protein") && <span className="tabular">{range(protein, " g protein")}</span>}
        {item.variants.length > 1 && <span>{item.variants.map((v) => v.label).filter(Boolean).join(" / ")}</span>}
      </div>
    </button>
  );
}