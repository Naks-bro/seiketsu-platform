"use client";

import type { DietFilter } from "@seiketsu/core/diet-filter";

export function FilterBar({ query, onQuery, filter, onFilter }: { query: string; onQuery: (q: string) => void; filter: DietFilter; onFilter: (f: DietFilter) => void }) {
  const chip = (diet: "egg" | "non_veg", label: string, color: string) => {
    const on = filter.diet === diet && !filter.vegOnly;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => onFilter({ vegOnly: false, diet: on ? null : diet })}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition ${on ? "border-ink bg-ink text-cream" : "border-line bg-white text-ink hover:border-ink/40"}`}
      >
        <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </button>
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-0 flex-1 basis-60">
        <span className="sr-only">Search the menu</span>
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search dishes, e.g. paneer, smoothie"
          className="w-full rounded-full border border-line bg-white py-2.5 pl-10 pr-4 text-base outline-none focus:border-berry sm:text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={filter.vegOnly}
          onClick={() => onFilter({ vegOnly: !filter.vegOnly, diet: null })}
          className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-sm font-semibold transition ${filter.vegOnly ? "border-veg bg-veg/10 text-veg" : "border-line bg-white text-ink"}`}
        >
          <span className={`relative h-6 w-10 rounded-full transition ${filter.vegOnly ? "bg-veg" : "bg-line"}`} aria-hidden>
            <span className={`absolute left-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${filter.vegOnly ? "translate-x-4" : ""}`}>
              <span className="size-2 rounded-full bg-veg" />
            </span>
          </span>
          Veg only
        </button>
        {chip("egg", "Egg", "var(--color-egg)")}
        {chip("non_veg", "Non-veg", "var(--color-nonveg)")}
      </div>
    </div>
  );
}
