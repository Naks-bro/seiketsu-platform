"use client";

import { useState } from "react";
import type { AddonGroupDTO, MenuItemDTO } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { DietMark } from "@/components/diet-mark";

const SHOWN = 4;

/** A white card with a title and hint, like each option block on Swiggy. */
export function OptionCard({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <legend className="sr-only">{title}</legend>
      <div className="border-b border-line px-4 pb-3 pt-4">
        <p aria-hidden className="text-base font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{hint}</p>
      </div>
      <div className="px-4 py-1.5">{children}</div>
    </fieldset>
  );
}

function Tick({ on, round }: { on: boolean; round?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-6 shrink-0 place-items-center border-2 transition ${round ? "rounded-full" : "rounded-md"} ${on ? "border-berry bg-berry text-cream" : "border-berry/40 bg-white"}`}
    >
      {on && (round ? <span className="size-2 rounded-full bg-cream" /> : <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="m3.5 8.5 3 3 6-7" /></svg>)}
    </span>
  );
}

const row = "flex min-h-12 w-full cursor-pointer items-center gap-3 py-2.5 text-left";

/** Sizes as a radio list: name and portion on the left, price and a radio on the right. */
export function SizePicker({ variants, value, onChange }: { variants: MenuItemDTO["variants"]; value: string; onChange: (id: string) => void }) {
  return (
    <OptionCard title="Size" hint="Select 1">
      {variants.map((v) => (
        <label key={v.id} className={`${row} has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-berry`}>
          <input type="radio" name="variant" value={v.id} checked={v.id === value} onChange={() => onChange(v.id)} className="sr-only" />
          <DietMark diet={v.diet} size={14} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-ink">{v.label ?? "Regular"}</span>
            {v.portion && <span className="block text-xs text-muted">{v.portion}</span>}
          </span>
          <span className="tabular text-sm font-medium text-ink">{formatINR(v.pricePaise)}</span>
          <Tick on={v.id === value} round />
        </label>
      ))}
    </OptionCard>
  );
}

/** Extras as checkbox lists per group, first four shown with "+n more". */
export function ExtrasPicker({ groups, chosen, onToggle }: { groups: AddonGroupDTO[]; chosen: string[]; onToggle: (id: string, group: AddonGroupDTO) => void }) {
  const [open, setOpen] = useState<string[]>([]);
  return (
    <>
      {groups.map((g) => {
        const picked = g.addons.filter((a) => chosen.includes(a.id)).length;
        const full = picked >= g.maxSelect;
        const expanded = open.includes(g.id) || g.addons.length <= SHOWN + 1;
        // Keep a ticked extra visible even when the list is folded.
        const list = expanded ? g.addons : g.addons.filter((a, i) => i < SHOWN || chosen.includes(a.id));
        const hidden = g.addons.length - list.length;
        const hint = g.maxSelect === 1 ? "Select 1 (optional)" : `Select up to ${g.maxSelect} option${g.maxSelect > 1 ? "s" : ""}`;
        return (
          <OptionCard key={g.id} title={g.name} hint={picked ? `${hint} · ${picked} added` : hint}>
            {list.map((a) => {
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
                  className={`${row} ${blocked ? "cursor-not-allowed opacity-45" : ""}`}
                >
                  <DietMark diet={a.diet} size={14} />
                  <span className="min-w-0 flex-1 font-medium text-ink">{a.name}</span>
                  <span className="tabular text-sm font-medium text-ink">+{formatINR(a.pricePaise)}</span>
                  <Tick on={on} />
                </button>
              );
            })}
            {hidden > 0 && (
              <button type="button" onClick={() => setOpen((o) => [...o, g.id])} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-berry">
                +{hidden} more
                <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m4 6 4 4 4-4" /></svg>
              </button>
            )}
          </OptionCard>
        );
      })}
    </>
  );
}
