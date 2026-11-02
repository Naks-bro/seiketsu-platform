"use client";

import { useActionState, useState } from "react";
import { INPUT_UNITS, type StockUnit } from "@seiketsu/core/inventory";
import { btnPrimary, field, FormMessage } from "@/components/admin/ui";
import { recordMovementAction } from "../../inventory-actions";

type Ing = { id: string; name: string; unit: StockUnit; onHand: string };

const KINDS = [
  { value: "purchase", label: "Delivery received", help: "Adds to stock. Enter the bill total to keep costs up to date." },
  { value: "wastage", label: "Wasted or spoiled", help: "Takes it out of stock and counts it as wastage." },
  { value: "count", label: "Counted the shelf", help: "Enter what is actually there now. Stock is set to this number." },
] as const;

export function MovementForm({ ingredients, suppliers, defaultIngredient }: { ingredients: Ing[]; suppliers: { id: string; name: string }[]; defaultIngredient?: string }) {
  const [state, action, pending] = useActionState(recordMovementAction, undefined);
  const [ingredientId, setIngredientId] = useState(defaultIngredient && ingredients.some((i) => i.id === defaultIngredient) ? defaultIngredient : "");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("purchase");
  const ing = ingredients.find((i) => i.id === ingredientId);
  const units = INPUT_UNITS[ing?.unit ?? "g"];
  const err = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">What happened?</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label
              key={k.value}
              className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-berry/30 ${kind === k.value ? "border-berry bg-berry/5 font-semibold text-berry" : "border-line bg-white"}`}
            >
              <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />
              {k.label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{KINDS.find((k) => k.value === kind)!.help}</p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm sm:col-span-2">
          Ingredient
          <select name="ingredientId" required value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className={field} aria-invalid={!!err.ingredientId}>
            <option value="">Choose…</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          {ing && <span className="block text-xs text-muted">On hand now: {ing.onHand}</span>}
        </label>
        <div className="space-y-1 text-sm sm:col-span-2">
          <label htmlFor="mv-qty">{kind === "count" ? "Counted quantity" : "Quantity"}</label>
          <div className="flex gap-2">
            <input id="mv-qty" name="qty" type="number" inputMode="decimal" min="0" step="any" required className={field} aria-invalid={!!err.qty} />
            <select name="qtyUnit" aria-label="Unit" className={`${field} w-24`} key={ing?.unit ?? "none"} defaultValue={units[0].label}>
              {units.map((u) => (
                <option key={u.label} value={u.label}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>

        {kind === "purchase" && (
          <>
            <label className="space-y-1 text-sm">
              Bill total (₹)
              <input name="total" type="number" inputMode="decimal" min="0" step="0.01" className={field} placeholder="Optional" />
            </label>
            <label className="space-y-1 text-sm">
              Supplier
              <select name="supplierId" className={field} defaultValue="">
                <option value="">Not recorded</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              Bill / invoice no.
              <input name="reference" maxLength={60} className={field} placeholder="Optional" />
            </label>
          </>
        )}
        <label className={`space-y-1 text-sm ${kind === "purchase" ? "" : "sm:col-span-2"}`}>
          Note
          <input name="note" maxLength={200} className={field} placeholder={kind === "wastage" ? "e.g. spoiled, dropped, expired" : "Optional"} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save"}</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
