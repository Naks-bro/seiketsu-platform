"use client";

import { useEffect, useRef, useState } from "react";
import type { CategoryDTO } from "@/lib/types";
import { useModal } from "../use-modal";

/** Which section is in view, for highlighting the rail and the chips. */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "");
  const key = ids.join("|");
  useEffect(() => {
    const els = key.split("|").map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [key]);
  return active;
}

export function CategoryRail({ cats, active }: { cats: CategoryDTO[]; active: string }) {
  return (
    <nav aria-label="Menu sections" className="sticky top-[9.5rem] hidden max-h-[calc(100dvh-11rem)] overflow-y-auto pr-2 md:block">
      <ul className="space-y-0.5 border-r border-line pr-3">
        {cats.map((c) => (
          <li key={c.id}>
            <a
              href={`#${c.slug}`}
              aria-current={active === c.slug ? "true" : undefined}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                active === c.slug ? "bg-berry font-semibold text-cream" : "text-muted hover:bg-paper hover:text-ink"
              }`}
            >
              <span>{c.name}</span>
              <span className="tabular text-xs opacity-70">{c.items.length}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CategoryChips({ cats, active }: { cats: CategoryDTO[]; active: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bar.current?.querySelector<HTMLElement>(`[data-slug="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);
  return (
    <div ref={bar} className="no-scrollbar relative -mx-4 flex gap-1.5 overflow-x-auto px-4 md:hidden">
      {cats.map((c) => (
        <a
          key={c.id}
          href={`#${c.slug}`}
          data-slug={c.slug}
          aria-current={active === c.slug ? "true" : undefined}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
            active === c.slug ? "border-berry bg-berry text-cream" : "border-line bg-white text-muted"
          }`}
        >
          {c.name}
        </a>
      ))}
    </div>
  );
}

/** Phones: a floating MENU button that opens a list of sections, Swiggy-style. */
export function JumpMenu({ cats, active }: { cats: CategoryDTO[]; active: string }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useModal(panel, open, () => setOpen(false));
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="fixed bottom-28 right-4 z-30 flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-cream shadow-xl"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M4 7h16M4 12h16M4 17h10" /></svg>
        Menu
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4">
          <div aria-hidden className="animate-fade-in absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Jump to a section" className="animate-sheet-up relative mb-24 w-64 rounded-2xl bg-ink p-2 text-cream shadow-2xl outline-none">
            <ul>
              {cats.map((c) => (
                <li key={c.id}>
                  <a
                    href={`#${c.slug}`}
                    onClick={() => setOpen(false)}
                    className={`flex justify-between rounded-xl px-4 py-2.5 text-sm ${active === c.slug ? "bg-cream/15 font-semibold" : "hover:bg-cream/10"}`}
                  >
                    {c.name}
                    <span className="tabular text-cream/60">{c.items.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
