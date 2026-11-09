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
import { ExtrasPicker, OptionCard, SizePicker } from "./menu/extras-picker";
import { cartLineFor } from "./menu/cart-line";
import { flyToCart } from "./fly-to-cart";
import { showToast } from "./toast";

const NO_FILTER: DietFilter = { vegOnly: false, diet: null };

type Props = { item: MenuItemDTO; onClose: () => void; filter?: DietFilter; editing?: CartLine | null };

export function ItemSheet({ item, onClose, filter = NO_FILTER, editing }: Props) {
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
        className="animate-sheet-up relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] bg-paper shadow-2xl outline-none sm:rounded-[1.75rem]"
      >
        <div className="relative z-10 flex shrink-0 items-center gap-3 bg-white px-4 py-3 shadow-[0_2px_8px_rgb(0_0_0/0.06)]">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-paper">
            {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" unoptimized /> : <DishArt category={item.categorySlug} seed={item.name} />}
          </div>
          <h2 id="item-title" className="line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-snug text-ink">
            {item.name}
            {variant.portion && <span className="font-normal text-muted"> ({variant.portion})</span>}
          </h2>
          <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-ink hover:bg-paper" aria-label={`Close ${item.name}`}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
          <div className="overflow-hidden rounded-2xl bg-white">
            {item.imageUrl && (
              <div className="relative aspect-square max-h-[42dvh] w-full bg-paper">
                <Image src={item.imageUrl} alt={item.name} fill sizes="(min-width: 640px) 576px, 100vw" className="object-cover" unoptimized />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-center gap-2">
                <DietMark diet={variant.diet ?? item.diet} size={14} />
                <span className="tabular font-semibold text-ink">{formatINR(variant.pricePaise)}</span>
              </div>
              {item.description && <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>}
              {n && (
                <dl className="tabular mt-4 grid grid-cols-5 divide-x divide-line rounded-xl border border-line text-center">
                  {(
                    [
                      ["kcal", n.kcal, ""],
                      ["Protein", n.proteinG, "g"],
                      ["Carbs", n.carbsG, "g"],
                      ["Fat", n.fatG, "g"],
                      ["Fibre", n.fibreG, "g"],
                    ] as const
                  ).map(([k, val, u]) => (
                    <div key={k} className="px-0.5 py-2">
                      <dt className="text-[11px] text-muted">{k}</dt>
                      <dd className="text-sm font-semibold">{val}{u}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {n && <p className="mt-1.5 text-[11px] text-muted">Approximate values for {[variant.label, variant.portion].filter(Boolean).join(" · ") || "this dish"}, supplied by Seiketsu.</p>}
            </div>
          </div>

          {variants.length > 1 && <SizePicker variants={variants} value={variant.id} onChange={setVariantId} />}
          {!editing && variants.length < item.variants.length && (
            <p className="px-1 text-xs text-muted">Showing the vegetarian option only. Turn off Veg only on the menu to see the others.</p>
          )}

          {groups.length > 0 && <ExtrasPicker groups={groups} chosen={addOnIds} onToggle={toggle} />}
          {hiddenExtras > 0 && <p className="px-1 text-xs text-muted">{hiddenExtras} extra{hiddenExtras > 1 ? "s are" : " is"} hidden because {hiddenExtras > 1 ? "they aren't" : "it isn't"} marked vegetarian.</p>}

          <OptionCard title="Cooking instructions" hint="Optional">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={2}
              aria-label="Cooking instructions"
              placeholder="e.g. dressing on the side, no onions"
              className="my-2 w-full rounded-xl border border-line bg-paper/50 px-3 py-2.5 text-base outline-none focus:border-berry sm:text-sm"
            />
          </OptionCard>
        </div>

        <div className="clear-badge flex shrink-0 items-center gap-3 border-t border-line bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <QuantityStepper value={qty} onChange={(v) => setQty(Math.max(1, Math.min(20, v)))} label={item.name} />
          <button
            ref={addBtn}
            type="button"
            onClick={save}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-berry px-4 font-semibold text-cream shadow-[var(--shadow-float)] transition hover:bg-berry-deep active:scale-[.98]"
          >
            <span>{editing ? "Update item" : "Add item"}</span>
            <span aria-hidden>·</span>
            <span className="tabular">{formatINR(unit * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
