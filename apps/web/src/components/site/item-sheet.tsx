"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useModal } from "./use-modal";
import type { MenuItemDTO } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { DietMark } from "@/components/diet-mark";
import { QuantityStepper } from "./cart-drawer";

export function ItemSheet({ item, canOrder, onClose }: { item: MenuItemDTO; canOrder: boolean; onClose: () => void }) {
  const { add, setDrawerOpen } = useCart();
  const [variantId, setVariantId] = useState(item.variants[0].id);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);
  const dialog = useRef<HTMLDivElement>(null);

  const variant = item.variants.find((v) => v.id === variantId)!;
  const allAddons = item.addonGroups.flatMap((g) => g.addons);
  const chosen = allAddons.filter((a) => addOnIds.includes(a.id));
  const unit = variant.pricePaise + chosen.reduce((s, a) => s + a.pricePaise, 0);

  useModal(dialog, true, onClose);

  function toggleAddon(id: string, max: number, groupIds: string[]) {
    setAddOnIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const inGroup = prev.filter((x) => groupIds.includes(x)).length;
      return inGroup >= max ? prev : [...prev, id];
    });
  }

  function addToCart() {
    add({
      menuItemId: item.id,
      variantId: variant.id,
      addOnIds,
      quantity: qty,
      note: note.trim() || undefined,
      name: item.name,
      variantLabel: [variant.label, variant.portion].filter(Boolean).join(" · ") || null,
      unitPricePaise: variant.pricePaise,
      addOns: chosen.map((a) => ({ id: a.id, name: a.name, pricePaise: a.pricePaise })),
      diet: variant.diet ?? item.diet,
    });
    onClose();
    setDrawerOpen(true);
  }

  const n = variant.nutrition;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div aria-hidden className="absolute inset-0 bg-ink/45" onClick={onClose} />
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-title"
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-cream shadow-2xl outline-none sm:rounded-3xl"
      >
        <div className="overflow-y-auto px-6 pb-4 pt-6">
          {item.imageUrl && (
            <div className="relative -mx-6 -mt-6 mb-5 aspect-[16/10] bg-paper">
              <Image src={item.imageUrl} alt={item.name} fill sizes="(min-width: 640px) 512px, 100vw" className="object-cover" unoptimized />
            </div>
          )}
          <div className="flex items-start gap-3">
            <div className="pt-2"><DietMark diet={variant.diet ?? item.diet} size={16} /></div>
            <h2 id="item-title" className="flex-1 font-display text-3xl leading-tight text-berry">{item.name}</h2>
            <button type="button" onClick={onClose} className="min-h-10 rounded-full px-3 py-1 text-sm text-muted hover:bg-paper" aria-label={`Close ${item.name}`}>
              Close
            </button>
          </div>
          {item.description && <p className="mt-3 leading-relaxed text-muted">{item.description}</p>}

          {item.variants.length > 1 && (
            <fieldset className="mt-6">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-olive-ink">Choose</legend>
              <div className="grid grid-cols-2 gap-2">
                {item.variants.map((v) => (
                  <label
                    key={v.id}
                    className={`flex cursor-pointer flex-col rounded-xl border px-4 py-3 transition ${
                      v.id === variantId ? "border-berry bg-white ring-1 ring-berry" : "border-line hover:border-berry/40"
                    }`}
                  >
                    <input type="radio" name="variant" value={v.id} checked={v.id === variantId} onChange={() => setVariantId(v.id)} className="sr-only" />
                    <span className="flex items-center gap-2 font-medium">
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

          {n && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-olive-ink">
                Nutrition{item.variants.length > 1 && variant.label ? ` · ${variant.label}` : ""}
                {variant.portion ? ` · ${variant.portion}` : ""}
              </p>
              <dl className="tabular grid grid-cols-5 divide-x divide-line rounded-xl border border-line bg-white/70 text-center">
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
                    <dd className="font-semibold">
                      {val}
                      {u}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-1.5 text-[11px] text-muted">Approximate values supplied by Seiketsu.</p>
            </div>
          )}

          {item.addonGroups.map((g) => {
            const ids = g.addons.map((a) => a.id);
            return (
              <fieldset key={g.id} className="mt-6">
                <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-olive-ink">Add {g.name.toLowerCase()}</legend>
                <ul className="divide-y divide-line rounded-xl border border-line bg-white/70">
                  {g.addons.map((a) => (
                    <li key={a.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={addOnIds.includes(a.id)}
                          onChange={() => toggleAddon(a.id, g.maxSelect, ids)}
                          className="size-4 accent-[var(--color-berry)]"
                        />
                        <DietMark diet={a.diet} size={12} />
                        <span className="flex-1 text-sm">{a.name}</span>
                        <span className="tabular text-sm text-muted">+{formatINR(a.pricePaise)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            );
          })}

          <label className="mt-6 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-olive-ink">Special instructions</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={2}
              placeholder="e.g. dressing on the side"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-berry"
            />
          </label>
        </div>

        <div className="flex items-center gap-3 border-t border-line bg-cream px-6 py-4">
          <QuantityStepper value={qty} onChange={(v) => setQty(Math.max(1, Math.min(20, v)))} label={item.name} />
          <button
            type="button"
            onClick={addToCart}
            disabled={!canOrder}
            className="flex flex-1 items-center justify-between rounded-full bg-berry px-5 py-3 font-semibold text-cream hover:bg-berry-deep disabled:cursor-not-allowed disabled:bg-muted"
          >
            <span>{canOrder ? "Add to order" : "Ordering closed"}</span>
            <span className="tabular">{formatINR(unit * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}