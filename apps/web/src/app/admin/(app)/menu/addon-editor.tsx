"use client";

import { useActionState } from "react";
import { ADDON_ICONS } from "@seiketsu/core/extras";
import { AddonIconMark } from "@/components/site/addon-icons";
import { saveAddonAction } from "../../menu-actions";

export function AddonEditor({ id, name, price, icon }: { id: string; name: string; price: number; icon: string | null }) {
  const [state, action, pending] = useActionState(saveAddonAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="addonId" value={id} />
      <label className="sr-only" htmlFor={`an-${id}`}>Extra name</label>
      <input id={`an-${id}`} name="name" defaultValue={name} className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-sm" />
      <label className="sr-only" htmlFor={`ap-${id}`}>{name} price in rupees</label>
      <span className="flex items-center gap-1 text-sm">₹<input id={`ap-${id}`} name="price" inputMode="decimal" defaultValue={price / 100} className="w-16 rounded-lg border border-line px-2 py-1.5 text-sm tabular-nums" /></span>
      <label className="sr-only" htmlFor={`ai-${id}`}>{name} icon</label>
      <span className="flex items-center gap-1">
        <AddonIconMark icon={icon} className="size-5 text-berry" />
        <select id={`ai-${id}`} name="icon" defaultValue={icon ?? ""} className="rounded-lg border border-line px-1.5 py-1.5 text-xs">
          <option value="">No icon</option>
          {ADDON_ICONS.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </span>
      <button type="submit" disabled={pending} className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper">{pending ? "…" : "Save"}</button>
      {state?.error && <span role="alert" className="w-full text-xs text-nonveg">{state.error}</span>}
      {state?.ok && <span role="status" className="text-xs text-veg">Saved</span>}
    </form>
  );
}