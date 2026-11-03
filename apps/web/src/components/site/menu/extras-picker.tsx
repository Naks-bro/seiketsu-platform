"use client";

import type { AddonGroupDTO } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { DietMark } from "@/components/diet-mark";
import { AddonIconMark } from "../addon-icons";

/** Subway-style shelves: one row of tappable tiles per group, with a pick-up-to limit. */
export function ExtrasPicker({ groups, chosen, onToggle }: { groups: AddonGroupDTO[]; chosen: string[]; onToggle: (id: string, group: AddonGroupDTO) => void }) {
  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const picked = g.addons.filter((a) => chosen.includes(a.id)).length;
        const full = picked >= g.maxSelect;
        return (
          <fieldset key={g.id}>
            <legend className="mb-2.5 flex w-full items-baseline justify-between gap-3">
              <span className="font-display text-xl text-ink">{g.name}</span>
              <span className={`text-xs ${full ? "font-semibold text-berry" : "text-muted"}`}>
                {g.maxSelect === 1 ? "Pick one" : `Pick up to ${g.maxSelect}`}
                {picked > 0 && ` · ${picked} added`}
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {g.addons.map((a) => {
                const on = chosen.includes(a.id);
                const blocked = !on && full && g.maxSelect > 1;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-disabled={blocked}
                    onClick={() => !blocked && onToggle(a.id, g)}
                    className={`group relative flex min-h-24 flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition ${
                      on
                        ? "border-berry bg-white shadow-[var(--shadow-card)] ring-1 ring-berry"
                        : blocked
                          ? "cursor-not-allowed border-line bg-white/40 opacity-50"
                          : "border-line bg-white/70 hover:-translate-y-0.5 hover:border-berry/40 hover:bg-white"
                    }`}
                  >
                    <span className={`grid size-10 place-items-center rounded-full transition ${on ? "bg-berry text-cream" : "bg-butter/70 text-berry group-hover:bg-butter"}`}>
                      <AddonIconMark icon={a.icon} className="size-6" />
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-medium leading-tight">
                      <DietMark diet={a.diet} size={11} />
                      {a.name}
                    </span>
                    <span className="tabular text-xs text-muted">+{formatINR(a.pricePaise)}</span>
                    <span
                      aria-hidden
                      className={`absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full text-[11px] font-bold transition ${
                        on ? "scale-100 bg-berry text-cream" : "scale-0"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
