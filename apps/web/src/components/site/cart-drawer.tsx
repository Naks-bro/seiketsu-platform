"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { useModal } from "./use-modal";
import { formatINR } from "@/lib/format";
import { unitTotal, useCart, type CartLine } from "@/lib/cart";
import { openLocationSheet, useLocation } from "@/lib/location";
import { DietMark } from "@/components/diet-mark";
import { AddonIconMark } from "./addon-icons";
import { DishArt } from "./menu/dish-art";

export type CartPricing = { deliveryFeePaise: number; freeDeliveryAbovePaise: number | null; minOrderPaise: number; deliveryEnabled: boolean };

export function BagIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 8h14l-1.1 10.6a2 2 0 0 1-2 1.8H8.1a2 2 0 0 1-2-1.8Z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </svg>
  );
}

/** Header cart: icon with a live count badge. The fly-to-cart animation lands here. */
export function CartButton() {
  const { count, ready, setDrawerOpen } = useCart();
  const n = ready ? count : 0;
  return (
    <button
      type="button"
      data-cart-target
      onClick={() => setDrawerOpen(true)}
      className="relative grid size-11 shrink-0 place-items-center rounded-full bg-cream text-berry transition hover:bg-butter"
      aria-label={`Open cart, ${n} item${n === 1 ? "" : "s"}`}
    >
      <BagIcon className="size-[22px]" />
      {n > 0 && (
        <span
          key={n}
          aria-hidden
          className="animate-bump tabular absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-orange px-1 text-[11px] font-bold text-ink ring-2 ring-berry"
        >
          {n}
        </span>
      )}
    </button>
  );
}

export function QuantityStepper({ value, onChange, label, size = "md" }: { value: number; onChange: (n: number) => void; label: string; size?: "sm" | "md" }) {
  const btn = size === "sm" ? "size-8" : "size-9";
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white" role="group" aria-label={`Quantity for ${label}`}>
      <button type="button" onClick={() => onChange(value - 1)} className={`grid ${btn} place-items-center rounded-full text-lg text-berry hover:bg-paper`} aria-label={value <= 1 ? `Remove ${label}` : "Decrease quantity"}>
        −
      </button>
      <span className="tabular w-6 text-center text-sm font-semibold" aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= 20}
        className={`grid ${btn} place-items-center rounded-full text-lg text-berry hover:bg-paper disabled:opacity-40`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

function Thumb({ line }: { line: CartLine }) {
  if (line.imageUrl) {
    return (
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-paper">
        <Image src={line.imageUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
      </div>
    );
  }
  return (
    <div className="relative size-16 shrink-0 overflow-hidden rounded-xl" aria-hidden>
      <DishArt category={line.categorySlug ?? ""} seed={line.name} />
    </div>
  );
}

function Line({ line, onEdit }: { line: CartLine; onEdit: () => void }) {
  const { setQuantity, remove } = useCart();
  return (
    <li className="py-4">
      <div className="flex gap-3">
        <Thumb line={line} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="pt-1"><DietMark diet={line.diet} size={12} /></span>
            <p className="flex-1 font-semibold leading-snug">{line.name}</p>
            <span className="tabular text-sm font-semibold">{formatINR(unitTotal(line) * line.quantity)}</span>
          </div>
          {line.variantLabel && <p className="mt-0.5 text-sm text-muted">{line.variantLabel} · <span className="tabular">{formatINR(line.unitPricePaise)}</span></p>}
        </div>
      </div>
      {line.addOns.length > 0 && (
        <ul className="ml-[76px] mt-2 space-y-1 rounded-xl bg-paper/70 px-3 py-2 text-sm" aria-label={`Extras on ${line.name}`}>
          {line.addOns.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <AddonIconMark icon={a.icon} className="size-4 text-olive-ink" />
              <span className="flex-1">{a.name}</span>
              <span className="tabular text-muted">+{formatINR(a.pricePaise)}</span>
            </li>
          ))}
        </ul>
      )}
      {line.note && <p className="ml-[76px] mt-2 text-sm italic text-muted">“{line.note}”</p>}
      <div className="ml-[76px] mt-3 flex items-center gap-3">
        <QuantityStepper value={line.quantity} onChange={(n) => setQuantity(line.key, n)} label={line.name} size="sm" />
        <button type="button" onClick={onEdit} className="min-h-9 rounded-full px-3 text-sm font-medium text-berry hover:bg-paper">
          Edit<span className="sr-only"> {line.name}</span>
        </button>
        <button type="button" onClick={() => remove(line.key)} className="min-h-9 rounded-full px-3 text-sm text-muted hover:bg-paper hover:text-nonveg">
          Remove<span className="sr-only"> {line.name}</span>
        </button>
      </div>
    </li>
  );
}

function Progress({ subtotal, pricing, delivery }: { subtotal: number; pricing: CartPricing; delivery: boolean }) {
  if (subtotal < pricing.minOrderPaise) {
    return (
      <p className="rounded-xl bg-butter/70 px-3 py-2 text-sm">
        Add <span className="tabular font-semibold">{formatINR(pricing.minOrderPaise - subtotal)}</span> more to reach the minimum order.
      </p>
    );
  }
  const free = pricing.freeDeliveryAbovePaise;
  if (!delivery || !pricing.deliveryEnabled || free === null || pricing.deliveryFeePaise === 0) return null;
  const left = free - subtotal;
  const pct = Math.min(100, Math.round((subtotal / free) * 100));
  return (
    <div className="space-y-1.5">
      <p className="text-sm">
        {left > 0 ? (
          <>Add <span className="tabular font-semibold">{formatINR(left)}</span> for free delivery</>
        ) : (
          <span className="font-semibold text-veg">You&apos;ve unlocked free delivery</span>
        )}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress to free delivery">
        <div className="h-full rounded-full bg-veg transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CartDrawer({ pricing, pickupFrom }: { pricing: CartPricing; pickupFrom: string }) {
  const { lines, drawerOpen, setDrawerOpen, subtotalPaise, count, setEditingKey } = useCart();
  const { location } = useLocation();
  const router = useRouter();
  const pathname = usePathname();
  const panel = useRef<HTMLDivElement>(null);

  useModal(panel, drawerOpen, () => setDrawerOpen(false));

  if (!drawerOpen) return null;

  function edit(key: string) {
    setEditingKey(key);
    setDrawerOpen(false);
    if (pathname !== "/menu") router.push("/menu");
  }

  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="animate-fade-in absolute inset-0 bg-ink/45" onClick={() => setDrawerOpen(false)} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="animate-drawer-in absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-cream shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="cart-title" className="font-display text-2xl text-berry">Your order</h2>
            {count > 0 && <p className="text-xs text-muted">{count} item{count === 1 ? "" : "s"}</p>}
          </div>
          <button type="button" onClick={() => setDrawerOpen(false)} className="min-h-10 rounded-full px-3 text-sm hover:bg-paper">
            Close
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setDrawerOpen(false);
            openLocationSheet();
          }}
          className="flex items-center gap-2 border-b border-line bg-paper/60 px-5 py-2.5 text-left text-sm hover:bg-paper"
        >
          <span className="text-muted">{!location ? "Delivery or pickup?" : location.mode === "pickup" ? "Pickup from" : "Delivering to"}</span>
          <span className="font-semibold">{!location ? "Choose" : location.mode === "pickup" ? pickupFrom : location.pincode}</span>
          <span className="ml-auto font-medium text-berry">Change</span>
        </button>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="grid size-20 place-items-center rounded-full bg-butter text-berry">
              <BagIcon className="size-9" />
            </div>
            <p className="font-display text-2xl">Your cart is empty.</p>
            <p className="text-sm text-muted">Pick a bowl, wrap or fresh-pressed juice to get started.</p>
            <Link href="/menu" onClick={() => setDrawerOpen(false)} className="rounded-full bg-berry px-6 py-3 text-sm font-semibold text-cream hover:bg-berry-deep">
              Browse the menu
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {lines.map((l) => (
                <Line key={l.key} line={l} onEdit={() => edit(l.key)} />
              ))}
            </ul>
            <div className="clear-badge space-y-3 border-t border-line bg-white/60 px-5 py-4">
              <Progress subtotal={subtotalPaise} pricing={pricing} delivery={location?.mode !== "pickup"} />
              <div className="flex justify-between text-base">
                <span>Subtotal</span>
                <span className="tabular font-semibold">{formatINR(subtotalPaise)}</span>
              </div>
              <p className="text-xs text-muted">Delivery and any taxes are added at checkout.</p>
              <Link
                href="/checkout"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between rounded-full bg-berry px-6 py-3.5 font-semibold text-cream shadow-[var(--shadow-float)] hover:bg-berry-deep"
              >
                <span>Checkout</span>
                <span className="tabular">{formatINR(subtotalPaise)} →</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Phones: a bar pinned to the bottom while the cart has something in it. */
export function MobileCartBar() {
  const { count, ready, subtotalPaise, setDrawerOpen } = useCart();
  const path = usePathname();
  if (!ready || count === 0 || path.startsWith("/checkout") || path.startsWith("/order") || path.startsWith("/bill")) return null;
  return (
    <>
      <div aria-hidden className="h-24 md:hidden" />
      <div className="clear-badge fixed inset-x-0 bottom-0 z-30 px-3 pb-3 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="animate-sheet-up flex w-full items-center justify-between rounded-2xl bg-berry px-5 py-3.5 text-cream shadow-[var(--shadow-float)]"
        >
          <span className="text-left text-sm leading-tight">
            <span className="tabular block font-semibold">{count} item{count === 1 ? "" : "s"} · {formatINR(subtotalPaise)}</span>
            <span className="text-xs text-cream/75">Extras and notes included</span>
          </span>
          <span className="flex items-center gap-2 font-semibold">
            View cart <BagIcon className="size-5" />
          </span>
        </button>
      </div>
    </>
  );
}
