"use client";

import { useSyncExternalStore } from "react";
import { useCart } from "@/lib/cart";

type Toast = { id: number; title: string; detail?: string };

let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Shows a short "added" note with a shortcut to the cart. */
export function showToast(t: Omit<Toast, "id">) {
  current = { ...t, id: Date.now() };
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    emit();
  }, 3200);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function Toaster() {
  const t = useSyncExternalStore(subscribe, () => current, () => null);
  const { setDrawerOpen } = useCart();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:inset-x-auto md:bottom-auto md:right-6 md:top-20"
    >
      {t && (
        <div key={t.id} className="animate-toast-in pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl bg-ink py-2.5 pl-3 pr-2.5 text-sm text-cream shadow-2xl">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-veg text-xs font-bold" aria-hidden>✓</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{t.title}</span>
            {t.detail && <span className="block truncate text-xs text-cream/70">{t.detail}</span>}
          </span>
          <button
            type="button"
            onClick={() => {
              current = null;
              emit();
              setDrawerOpen(true);
            }}
            className="shrink-0 rounded-full bg-cream/15 px-3 py-2 text-xs font-semibold hover:bg-cream/25"
          >
            View cart
          </button>
        </div>
      )}
    </div>
  );
}
