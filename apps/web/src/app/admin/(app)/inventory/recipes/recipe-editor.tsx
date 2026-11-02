"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { costOf, foodCostBps, INPUT_UNITS, toMilli, type StockUnit } from "@seiketsu/core/inventory";
import { formatINR } from "@seiketsu/core/money";
import { btnGhost, btnPrimary, field, FormMessage } from "@/components/admin/ui";
import { saveRecipeAction, type InvResult } from "../../../inventory-actions";

type Ing = { id: string; name: string; unit: StockUnit; cost: number | null };
type Line = { key: number; ingredientId: string; qty: string; qtyUnit: string };

const smallUnit = (u: StockUnit) => INPUT_UNITS[u][INPUT_UNITS[u].length - 1].label;

export function RecipeEditor({
  target,
  pricePaise,
  ingredients,
  initial,
  canEdit,
}: {
  target: { variantId?: string; addonId?: string };
  pricePaise: number;
  ingredients: Ing[];
  initial: { ingredientId: string; qty: string; qtyUnit: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(initial.map((l, i) => ({ ...l, key: i })));
  const [nextKey, setNextKey] = useState(initial.length);
  const [state, setState] = useState<InvResult>();
  const [pending, start] = useTransition();
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const add = () => {
    setLines((ls) => [...ls, { key: nextKey, ingredientId: "", qty: "", qtyUnit: "g" }]);
    setNextKey((k) => k + 1);
  };

  let total = 0;
  let unknown = false;
  for (const l of lines) {
    const ing = byId.get(l.ingredientId);
    const n = Number(l.qty);
    if (!ing || !l.qty || !Number.isFinite(n)) continue;
    if (ing.cost === null) unknown = true;
    else if (INPUT_UNITS[ing.unit].some((u) => u.label === l.qtyUnit)) total += costOf(toMilli(n, l.qtyUnit, ing.unit), ing.cost);
  }
  const bps = foodCostBps(Math.round(total), pricePaise);

  const save = () =>
    start(async () => {
      const res = await saveRecipeAction({ ...target, lines: lines.map(({ ingredientId, qty, qtyUnit }) => ({ ingredientId, qty, qtyUnit })) });
      setState(res);
      if (res?.ok) router.refresh();
    });

  if (!ingredients.length) {
    return <p className="text-sm text-muted">Add ingredients on the Stock tab first, then come back to build the recipe.</p>;
  }

  return (
    <div className="space-y-4">
      {lines.length === 0 && <p className="text-sm text-muted">No ingredients in this recipe yet, so selling it does not change stock.</p>}
      <ul className="space-y-2">
        {lines.map((l, i) => {
          const ing = byId.get(l.ingredientId);
          const units = INPUT_UNITS[ing?.unit ?? "g"];
          const unitValue = units.some((u) => u.label === l.qtyUnit) ? l.qtyUnit : units[units.length - 1].label;
          return (
            <li key={l.key} className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-white p-3">
              <label className="min-w-48 flex-1 space-y-1 text-sm">
                Ingredient {i + 1}
                <select
                  value={l.ingredientId}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const next = byId.get(e.target.value);
                    update(l.key, { ingredientId: e.target.value, qtyUnit: next ? smallUnit(next.unit) : l.qtyUnit });
                  }}
                  className={field}
                >
                  <option value="">Choose…</option>
                  {ingredients.map((x) => (
                    <option key={x.id} value={x.id} disabled={x.id !== l.ingredientId && lines.some((o) => o.ingredientId === x.id)}>{x.name}</option>
                  ))}
                </select>
              </label>
              <label className="w-28 space-y-1 text-sm">
                Per portion
                <input type="number" inputMode="decimal" min="0" step="any" value={l.qty} disabled={!canEdit} onChange={(e) => update(l.key, { qty: e.target.value })} className={field} />
              </label>
              <label className="w-24 space-y-1 text-sm">
                <span className="sr-only">Unit for ingredient {i + 1}</span>
                <select value={unitValue} disabled={!canEdit} onChange={(e) => update(l.key, { qtyUnit: e.target.value })} className={field}>
                  {units.map((u) => (
                    <option key={u.label} value={u.label}>{u.label}</option>
                  ))}
                </select>
              </label>
              {canEdit && (
                <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className={btnGhost} aria-label={`Remove ingredient ${i + 1}${ing ? ` (${ing.name})` : ""}`}>
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-sm" aria-live="polite">
        Ingredient cost per portion: <strong className="tabular">{formatINR(Math.round(total))}</strong>
        {bps !== null && total > 0 && <span className="text-muted"> ({Math.round(bps / 100)}% of the {formatINR(pricePaise)} price)</span>}
        {unknown && <span className="block text-xs text-muted">Some ingredients have no cost yet, so the real cost is higher. Record a delivery with its bill total to fill this in.</span>}
      </p>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={add} className={btnGhost} disabled={lines.length >= 40}>Add ingredient</button>
          <button type="button" onClick={save} disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save recipe"}</button>
          <FormMessage state={state} />
        </div>
      ) : (
        <p className="text-sm text-muted">Only the owner or a manager can change recipes.</p>
      )}
    </div>
  );
}
