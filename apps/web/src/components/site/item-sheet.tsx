"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { allowedAddon, allowedVariants, type DietFilter } from "@seiketsu/core/diet-filter";
import type { AddonGroupDTO, MenuItemDTO } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { useCart, type CartLine } from "@/lib/cart";
import { requestLocation } from "@/lib/location";
import { DietMark } from "@/components/diet-mark";
import { DishArt } from "./menu/dish-art";
import { useModal } from "./use-modal";
import { QuantityStepper } from "./cart-drawer";
import { ExtrasPicker } from "./menu/extras-picker";
import { cartLineFor } from "./menu/cart-line";
import { flyToCart } from "./fly-to-cart";
import { showToast } from "./toast";

const NO_FILTER: DietFilter = { vegOnly: false, diet: null };

type Props = { item: MenuItemDTO; canOrder: boolean; onClose: () => void; filter?: DietFilter; editing?: CartLine | null };

export function ItemSheet({ item, canOrder, onClose, filter = NO_FILTER, editing }: Props) {
  const { add, replace } = useCart();
  const variants = editing ? item.variants : allowedVariants(item, filter);
  const [variantId, setVariantId] = useState(editing?.variantId ?? variants[0].id);
  const [addOnIds, setAddOnIds] = useState<string[]>(editing?.addOnIds ?? []);
  const [note, setNote] = useState(editing?.note ?? "");
  const [qty, setQty] = useState(editing?.quantity ?? 1);
  const dialog = useRef<HTMLDivElement>(null);
  const addBtn = useRef<HTMLButtonElement>(null);

  const variant = item.variants.find((v) => v.id === variantId) ?? variants[0];
  const groups: AddonGroupDTO[] = item.addonGroups
    .map((g) => ({ ...g, addons: g.addons.filter((a) => addOnIds.includes(a.id) || allowedAddon(a, filter)) }))
    .filter((g) => g.addons.length > 0);
  const hiddenExtras = item.addonGroups.flatMap((g) => g.addons).length - groups.flatMap((g) => g.addons).length;
  const chosen = item.addonGroups.flatMap((g) => g.addons).filter((a) => addOnIds.includes(a.id));
  const unit = variant.pricePaise + chosen.reduce((s, a) => s + a.pricePaise, 0);

  useModal(dialog, true, onClose);

  function toggle(id: string, g: AddonGroupDTO) {
    setAddOnIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const inGroup = prev.filter((x) => g.addons.some((a) => a.id === x));
      if (g.maxSelect === 1) return [...prev.filter((x) => !inGroup.includes(x)), id];
      return inGroup.length >= g.maxSelect ? prev : [...prev, id];
    });
  }

  async function save() {
    if (!editing && !(await requestLocation())) return;
    const line = cartLineFor(item, variant, chosen, qty, note);
    if (editing) {
      replace(editing.key, line);
      showToast({ title: `Updated ${item.name}` });
    } else {
      add(line);
      flyToCart(addBtn.current, item.imageUrl);
      showToast({ title: `Added ${item.name}`, detail: [line.variantLabel, chosen.length ? `${chosen.length} extra${chosen.length > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ") || undefined });
    }
    onClose();
  }

  const n = variant.nutrition;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden className="animate-fade-in absolute inset-0 bg-ink/50" onClick={onClose} />
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-title"
        className="animate-sheet-up relative flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] bg-cream shadow-2xl outline-none sm:rounded-[1.75rem]"
      >
        <div className="overflow-y-auto">
          {item.imageUrl ? (
            <div className="relative aspect-[16/9] bg-paper">
              <Image src={item.imageUrl} alt={item.name} fill sizes="(min-width: 640px) 576px, 100vw" className="object-cover" unoptimized />
            </div>
          ) : (
            <div className="relative aspect-[3/1]">
              <DishArt category={item.categorySlug} seed={item.name} size="lg" />
            </div>
          )}
          <div className="px-6 pb-6 pt-5">
            <div className="flex items-start gap-3">
              <div className="pt-2.5"><DietMark diet={variant.diet ?? item.diet} size={16} /></div>
              <h2 id="item-title" className="flex-1 font-display text-3xl leading-tight text-berry">{item.name}</h2>
              <button type="button" onClick={onClose} className="min-h-10 shrink-0 rounded-full px-3 text-sm text-muted hover:bg-paper" aria-label={`Close ${item.name}`}>
                Close
              </button>
            </div>
            {item.description && <p className="mt-2 leading-relaxed text-muted">{item.description}</p>}

            {n && (
              <dl className="tabular mt-5 grid grid-cols-5 divide-x divide-line rounded-2xl border border-line bg-white/80 text-center">
                {(
                  [
                    ["kcal", n.kcal, ""],
                    ["Protein", n.proteinG, "g"],
                    ["Carbs", n.carbsG, "g"],
                    ["Fat", n.fatG, "g"],
                    ["Fibre", n.fibreG, "g"],
                  ] as const
                ).map(([k, val, u]) => (
                  <div key={k} className="px-1 py-2.5">
                    <dt className="text-[11px] text-muted">{k}</dt>
                    <dd className="font-semibold">{val}{u}</dd>
                  </div>
                ))}
              </dl>
            )}
            {n && <p className="mt-1.5 text-[11px] text-muted">Approximate values for {[variant.label, variant.portion].filter(Boolean).join(" · ") || "this dish"}, supplied by Seiketsu.</p>}

            {variants.length > 1 && (
              <fieldset className="mt-7">
                <legend className="mb-2.5 font-display text-xl text-ink">Choose your size</legend>
                <div className="grid grid-cols-2 gap-2">
                  {variants.map((v) => (
                    <label
                      key={v.id}
                      className={`flex cursor-pointer flex-col rounded-2xl border px-4 py-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-berry ${
                        v.id === variant.id ? "border-berry bg-white ring-1 ring-berry" : "border-line bg-white/60 hover:border-berry/40"
                      }`}
                    >
                      <input type="radio" name="variant" value={v.id} checked={v.id === variant.id} onChange={() => setVariantId(v.id)} className="sr-only" />
                      <span className="flex items-center gap-2 font-semibold">
                        <DietMark diet={v.diet} size={12} />
                        {v.label ?? "Regular"}
                      </span>
                      <span className="tabular text-sm text-muted">
                        {v.portion ? `${v.portion} · ` : ""}
                        {formatINR(v.pricePaise)}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {!editing && variants.length < item.variants.length && (
              <p className="mt-2 text-xs text-muted">Showing the vegetarian option only. Turn off Veg only on the menu to see the others.</p>
            )}

            {groups.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-olive-ink">Make it yours</h3>
                <p className="mb-4 text-sm text-muted">Add extras to your {item.name.toLowerCase()}. All optional.</p>
                <ExtrasPicker groups={groups} chosen={addOnIds} onToggle={toggle} />
                {hiddenExtras > 0 && <p className="mt-3 text-xs text-muted">{hiddenExtras} extra{hiddenExtras > 1 ? "s are" : " is"} hidden because {hiddenExtras > 1 ? "they aren't" : "it isn't"} marked vegetarian.</p>}
              </div>
            )}

            <label className="mt-8 block">
              <span className="mb-2 block font-display text-xl text-ink">Anything we should know?</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                rows={2}
                placeholder="e.g. dressing on the side, no onions"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-berry"
              />
            </label>
          </div>
        </div>

        <div className="clear-badge flex items-center gap-3 border-t border-line bg-cream/95 px-6 py-4 backdrop-blur">
          <QuantityStepper value={qty} onChange={(v) => setQty(Math.max(1, Math.min(20, v)))} label={item.name} />
          <button
            ref={addBtn}
            type="button"
            onClick={save}
            disabled={!canOrder}
            className="flex flex-1 items-center justify-between rounded-full bg-berry px-5 py-3.5 font-semibold text-cream shadow-[var(--shadow-float)] transition hover:bg-berry-deep active:scale-[.98] disabled:cursor-not-allowed disabled:bg-muted disabled:shadow-none"
          >
            <span>{!canOrder ? "Ordering closed" : editing ? "Update item" : "Add to order"}</span>
            <span className="tabular">{formatINR(unit * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
