"use client";

import Link from "next/link";
import { useRef } from "react";
import { useModal } from "./use-modal";
import { formatINR } from "@/lib/format";
import { unitTotal, useCart } from "@/lib/cart";
import { DietMark } from "@/components/diet-mark";

export function CartButton() {
  const { count, ready, setDrawerOpen } = useCart();
  return (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      className="flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm font-semibold text-berry transition hover:bg-butter"
      aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M5 7h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 7Z" />
        <path d="M9 7V6a3 3 0 0 1 6 0v1" />
      </svg>
      <span className="tabular">{ready ? count : 0}</span>
    </button>
  );
}

export function QuantityStepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-cream" role="group" aria-label={`Quantity for ${label}`}>
      <button type="button" onClick={() => onChange(value - 1)} className="grid size-8 place-items-center rounded-full text-lg hover:bg-paper" aria-label="Decrease quantity">
        −
      </button>
      <span className="tabular w-6 text-center text-sm font-semibold" aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= 20}
        className="grid size-8 place-items-center rounded-full text-lg hover:bg-paper disabled:opacity-40"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

export function CartDrawer() {
  const { lines, drawerOpen, setDrawerOpen, setQuantity, subtotalPaise, count } = useCart();
  const panel = useRef<HTMLDivElement>(null);

  useModal(panel, drawerOpen, () => setDrawerOpen(false));

  if (!drawerOpen) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => setDrawerOpen(false)} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-cream shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="cart-title" className="font-display text-2xl text-berry">Your order</h2>
          <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-full px-3 py-1.5 text-sm hover:bg-paper">
            Close
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="font-display text-xl">Your cart is empty.</p>
            <p className="text-sm text-muted">Pick a bowl, wrap or juice from the menu to get started.</p>
            <Link href="/menu" onClick={() => setDrawerOpen(false)} className="rounded-full bg-berry px-5 py-2.5 text-sm font-semibold text-cream hover:bg-berry-deep">
              Browse the menu
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {lines.map((l) => (
                <li key={l.key} className="flex gap-3 py-4">
                  <div className="pt-1"><DietMark diet={l.diet} /></div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium leading-snug">{l.name}</p>
                    {l.variantLabel && <p className="text-sm text-muted">{l.variantLabel}</p>}
                    {l.addOns.length > 0 && <p className="text-sm text-muted">+ {l.addOns.map((a) => a.name).join(", ")}</p>}
                    {l.note && <p className="text-sm italic text-muted">“{l.note}”</p>}
                    <div className="flex items-center justify-between pt-1">
                      <QuantityStepper value={l.quantity} onChange={(n) => setQuantity(l.key, n)} label={l.name} />
                      <span className="tabular text-sm font-semibold">{formatINR(unitTotal(l) * l.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="clear-badge space-y-3 border-t border-line px-5 py-5">
              <div className="flex justify-between text-base">
                <span>Subtotal · {count} item{count === 1 ? "" : "s"}</span>
                <span className="tabular font-semibold">{formatINR(subtotalPaise)}</span>
              </div>
              <p className="text-xs text-muted">Taxes and delivery, if any, are shown at checkout.</p>
              <Link
                href="/checkout"
                onClick={() => setDrawerOpen(false)}
                className="block rounded-full bg-berry py-3 text-center font-semibold text-cream hover:bg-berry-deep"
              >
                Checkout
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}