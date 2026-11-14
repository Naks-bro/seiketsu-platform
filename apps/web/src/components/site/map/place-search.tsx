"use client";

import { useEffect, useId, useState } from "react";
import type { LatLng } from "@seiketsu/core/delivery-zones";

export type Place = { label: string; line: string; area: string; city: string; pincode: string; lat: number; lng: number };

/**
 * Address search with suggestions as you type (free OpenStreetMap search through our own server), biased towards
 * `near`. Used on the customer's location sheet, the map picker and the admin zones map.
 */
export function PlaceSearch({
  near,
  onPick,
  placeholder = "Search area, street, building…",
  autoFocus = false,
  className = "",
  floating = false,
}: {
  near: LatLng | null;
  onPick: (p: Place) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** Results float over what is below (on a map) instead of pushing it down. */
  floating?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (q.trim().length < 3) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setBusy(true);
      const at = near ? `&lat=${near.lat}&lng=${near.lng}` : "";
      fetch(`/api/geo/search?q=${encodeURIComponent(q)}${at}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d: { results?: Place[]; error?: string }) => {
          setResults(d.results ?? []);
          setActive(-1);
          setNote(d.error ?? (d.results?.length ? null : "No matches. Try a nearby landmark or the area name."));
        })
        .catch(() => {})
        .finally(() => setBusy(false));
    }, 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
    // Search follows the text; a moving `near` should not re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function pick(p: Place) {
    setResults([]);
    setNote(null);
    setQ("");
    onPick(p);
  }

  const open = q.trim().length >= 3 && (results.length > 0 || !!note);

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3.5 shadow-sm focus-within:border-berry">
        <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <label htmlFor={`${id}-q`} className="sr-only">
          {placeholder}
        </label>
        <input
          id={`${id}-q`}
          value={q}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length < 3) {
              setResults([]);
              setNote(null);
            }
          }}
          onKeyDown={(e) => {
            if (!results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(results[Math.max(active, 0)]);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-transparent py-3 text-[15px] outline-none focus-visible:outline-none!"
        />
        {busy ? (
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-berry/30 border-t-berry" aria-hidden="true" />
        ) : q ? (
          <button type="button" onClick={() => (setQ(""), setResults([]), setNote(null))} className="shrink-0 rounded-full p-1 text-muted hover:bg-paper" aria-label="Clear search">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label="Search results"
          className={`${floating ? "absolute inset-x-0 top-full z-30" : "relative"} mt-2 max-h-72 overflow-auto rounded-2xl border border-line bg-white py-1 shadow-lg`}
        >
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${r.label}`} role="option" aria-selected={i === active}>
              <button type="button" onClick={() => pick(r)} className={`flex w-full items-start gap-3 px-3.5 py-2.5 text-left hover:bg-paper ${i === active ? "bg-paper" : ""}`}>
                <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-berry" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
                  <circle cx="12" cy="9.5" r="2.5" />
                </svg>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.line}</span>
                  <span className="block truncate text-xs text-muted">{[r.area, r.city, r.pincode].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            </li>
          ))}
          {!results.length && note && <li className="px-3.5 py-2.5 text-sm text-muted">{note}</li>}
        </ul>
      )}
    </div>
  );
}
