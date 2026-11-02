"use client";

import { useActionState, useState } from "react";
import { INPUT_UNITS, STOCK_UNITS, UNIT_NAME, type StockUnit } from "@seiketsu/core/inventory";
import { btnPrimary, field, FormMessage } from "@/components/admin/ui";
import { saveIngredientAction } from "../../inventory-actions";

export type IngredientDefaults = { id?: string; name?: string; unit?: StockUnit; reorder?: string; reorderUnit?: string; supplierId?: string | null };

export function IngredientForm({ initial = {}, suppliers, unitLocked }: { initial?: IngredientDefaults; suppliers: { id: string; name: string }[]; unitLocked?: boolean }) {
  const [state, action, pending] = useActionState(saveIngredientAction, undefined);
  const [unit, setUnit] = useState<StockUnit>(initial.unit ?? "g");
  const err = state?.fieldErrors ?? {};
  const units = INPUT_UNITS[unit];
  const key = initial.id ?? "new";

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <label className="space-y-1 text-sm">
        Name
        <input name="name" required maxLength={60} defaultValue={initial.name} className={field} placeholder="e.g. Chicken breast" aria-invalid={!!err.name} />
      </label>
      <label className="space-y-1 text-sm">
        Measured by
        <select name={unitLocked ? undefined : "unit"} value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)} className={field} disabled={unitLocked}>
          {STOCK_UNITS.map((u) => (
            <option key={u} value={u}>{UNIT_NAME[u]}</option>
          ))}
        </select>
        {unitLocked && (
          <>
            <input type="hidden" name="unit" value={unit} />
            <span className="block text-xs text-muted">Fixed once stock or recipes use it.</span>
          </>
        )}
      </label>
      <div className="space-y-1 text-sm">
        <label htmlFor={`reorder-${key}`}>Warn me when stock falls to</label>
        <div className="flex gap-2">
          <input id={`reorder-${key}`} name="reorder" type="number" inputMode="decimal" min="0" step="any" defaultValue={initial.reorder} className={field} placeholder="Optional" />
          <select name="reorderUnit" aria-label="Unit" key={unit} defaultValue={initial.unit === unit && initial.reorderUnit ? initial.reorderUnit : units[0].label} className={`${field} w-24`}>
            {units.map((u) => (
              <option key={u.label} value={u.label}>{u.label}</option>
            ))}
          </select>
        </div>
      </div>
      <label className="space-y-1 text-sm">
        Usual supplier
        <select name="supplierId" defaultValue={initial.supplierId ?? ""} className={field}>
          <option value="">None</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : initial.id ? "Save changes" : "Add ingredient"}</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
