"use client";

import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { itemDiets, matchesDiet, wantedDiet, type DietFilter } from "@seiketsu/core/diet-filter";
import type { CategoryDTO, MenuItemDTO } from "@/lib/types";
import { whatsappLink } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { ItemSheet } from "../item-sheet";
import { DishRow } from "./dish-row";
import { FilterBar } from "./filter-bar";
import { CategoryChips, CategoryRail, JumpMenu, useActiveSection } from "./category-nav";

const readHash = () => decodeURIComponent(window.location.hash.slice(1));
function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function MenuBrowser({ menu, canOrder, whatsapp }: { menu: CategoryDTO[]; canOrder: boolean; whatsapp: string | null }) {
  const { reconcile, lines, editingKey, setEditingKey } = useCart();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DietFilter>({ vegOnly: false, diet: null });
  const [picked, setPicked] = useState<MenuItemDTO | null>(null);
  const [closedHash, setClosedHash] = useState<string | null>(null);
  const q = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    reconcile(menu);
  }, [menu, reconcile]);

  const all = useMemo(() => menu.flatMap((c) => c.items), [menu]);
  // Deep link: /menu#item-slug opens that dish. Editing from the cart opens its dish too.
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const hashItem = hash && hash !== closedHash ? all.find((i) => i.slug === hash) : undefined;
  const editing = editingKey ? (lines.find((l) => l.key === editingKey) ?? null) : null;
  const editItem = editing ? all.find((i) => i.id === editing.menuItemId) : undefined;
  const open = editItem ?? picked ?? hashItem ?? null;
  const close = () => {
    setPicked(null);
    setClosedHash(hash);
    setEditingKey(null);
  };

  const filtered = useMemo(
    () =>
      menu
        .map((c) => ({
          ...c,
          items: c.items.filter(
            (i) => matchesDiet(i, filter) && (!q || `${i.name} ${i.description ?? ""} ${c.name}`.toLowerCase().includes(q)),
          ),
        }))
        .filter((c) => c.items.length > 0),
    [menu, q, filter],
  );
  const unmarked = filter.vegOnly ? all.filter((i) => itemDiets(i).size === 0).length : 0;
  const active = useActiveSection(filtered.map((c) => c.slug));
  const wa = whatsappLink(whatsapp, "Hi Seiketsu! I would like to place an order.");

  return (
    <>
      <div className="sticky top-16 z-20 -mx-4 space-y-3 border-b border-line bg-cream/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <FilterBar query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} />
        <CategoryChips cats={filtered} active={active} />
        <JumpMenu cats={filtered} active={active} />
      </div>

      {filter.vegOnly && (
        <p className="mt-4 rounded-xl bg-veg/10 px-4 py-2.5 text-sm text-veg">
          Showing dishes marked vegetarian.
          {unmarked > 0 && <span className="text-ink"> {unmarked} dish{unmarked > 1 ? "es aren't" : " isn't"} marked yet; ask us about {unmarked > 1 ? "them" : "it"}.</span>}
        </p>
      )}

      {!canOrder && (
        <div className="mt-6 rounded-2xl bg-butter/60 p-4 text-sm">
          Online ordering is closed right now. You can still browse the menu
          {wa ? (
            <>
              {" "}or{" "}
              <a href={wa} target="_blank" rel="noreferrer" className="font-semibold text-berry underline">message us on WhatsApp</a>
            </>
          ) : null}
          .
        </div>
      )}

      <div className="mt-6 grid gap-8 md:grid-cols-[13rem_1fr]">
        <div>
          <CategoryRail cats={filtered} active={active} />
        </div>
        <div className="min-w-0">
          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-display text-2xl">Nothing matches that.</p>
              <p className="mt-2 text-muted">Try another word, or clear the filters.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter({ vegOnly: false, diet: null });
                }}
                className="mt-4 rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:bg-paper"
              >
                Clear search and filters
              </button>
            </div>
          )}
          {filtered.map((c) => (
            <section key={c.id} id={c.slug} className="scroll-mt-40 pb-6" aria-labelledby={`h-${c.slug}`}>
              <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink/80 pb-2 pt-4">
                <h2 id={`h-${c.slug}`} className="font-display text-3xl text-ink">{c.name}</h2>
                <span className="tabular text-sm text-muted">{c.items.length} item{c.items.length === 1 ? "" : "s"}</span>
              </div>
              <div className="divide-y divide-dashed divide-line">
                {c.items.map((item) => (
                  <div key={item.id} id={item.slug}>
                    <DishRow item={item} canOrder={canOrder} onCustomise={() => setPicked(item)} onlyDiet={wantedDiet(filter)} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {open && <ItemSheet key={`${open.id}-${editing?.key ?? ""}`} item={open} canOrder={canOrder} onClose={close} filter={filter} editing={editItem ? editing : null} />}
    </>
  );
}
