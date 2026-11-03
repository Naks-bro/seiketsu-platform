"use client";

import { useState } from "react";
import { clearPincodesAction, removePincodeAction } from "../../delivery-area-actions";

export function PincodeList({ pins }: { pins: string[] }) {
  const [q, setQ] = useState("");
  if (!pins.length) return null;
  const shown = q ? pins.filter((p) => p.includes(q.replace(/\D/g, ""))) : pins;

  return (
    <section aria-labelledby="list-h" className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="list-h" className="font-display text-2xl">Your pincodes</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm">
            <span className="sr-only">Find a pincode</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="numeric" placeholder="Find…" className="w-32 rounded-full border border-line px-3 py-1.5 text-sm outline-none focus:border-berry" />
          </label>
          <form action={clearPincodesAction} onSubmit={(e) => !confirm(`Remove all ${pins.length} pincodes? Until you add some back, every pincode will count as one you deliver to.`) && e.preventDefault()}>
            <button type="submit" className="text-sm text-nonveg hover:underline">Remove all</button>
          </form>
        </div>
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {shown.map((p) => (
          <li key={p}>
            <form action={removePincodeAction} className="flex items-center gap-1 rounded-full border border-line bg-paper py-1 pl-3 pr-1 text-sm tabular">
              {p}
              <input type="hidden" name="pin" value={p} />
              <button type="submit" className="grid size-6 place-items-center rounded-full text-muted hover:bg-nonveg/10 hover:text-nonveg" aria-label={`Remove ${p}`}>
                ×
              </button>
            </form>
          </li>
        ))}
        {!shown.length && <li className="text-sm text-muted">No pincode matches “{q}”.</li>}
      </ul>
    </section>
  );
}
