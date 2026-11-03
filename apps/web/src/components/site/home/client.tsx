"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MenuItemDTO } from "@/lib/types";
import { useCart } from "@/lib/cart";
import { openLocationSheet, requestLocation, useLocation } from "@/lib/location";
import { flyToCart } from "../fly-to-cart";
import { showToast } from "../toast";
import { cartLineFor, isSimple } from "../menu/cart-line";

export function CheckDeliveryButton({ className }: { className: string }) {
  const { location } = useLocation();
  return (
    <button type="button" onClick={openLocationSheet} className={className}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
      {location?.mode === "delivery" ? `Delivering to ${location.pincode}` : location?.mode === "pickup" ? "Pickup in Versova" : "Check delivery"}
    </button>
  );
}

/** ADD on a favourite: simple dishes go straight in; the rest open on the menu. */
export function QuickAdd({ item, canOrder }: { item: MenuItemDTO; canOrder: boolean }) {
  const { add } = useCart();
  const btn = useRef<HTMLButtonElement>(null);
  if (!isSimple(item) || !canOrder) {
    return (
      <Link href={`/menu#${item.slug}`} className="rounded-full bg-berry px-4 py-2 text-sm font-semibold text-cream hover:bg-berry-deep">
        {canOrder ? "Customise" : "View"}
        <span className="sr-only"> {item.name}</span>
      </Link>
    );
  }
  return (
    <button
      ref={btn}
      type="button"
      onClick={async () => {
        if (!(await requestLocation())) return;
        add(cartLineFor(item, item.variants[0], [], 1));
        flyToCart(btn.current, item.imageUrl);
        showToast({ title: `Added ${item.name}` });
      }}
      className="rounded-full bg-berry px-5 py-2 text-sm font-extrabold tracking-wider text-cream hover:bg-berry-deep active:scale-95"
      aria-label={`Add ${item.name}`}
    >
      ADD
    </button>
  );
}

/**
 * Hero film: muted, looping, inline. The poster shows until it plays (and if the file is missing).
 * Paused for visitors who prefer less motion, with a pause/play button for everyone.
 */
export function HeroVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const sync = () => setPlaying(!v.paused);
    v.addEventListener("play", sync);
    v.addEventListener("pause", sync);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) v.pause();
    // Autoplay may have started before this effect ran.
    queueMicrotask(sync);
    return () => {
      v.removeEventListener("play", sync);
      v.removeEventListener("pause", sync);
    };
  }, []);
  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }
  return (
    <>
      <video ref={ref} className="size-full object-cover" src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" aria-label={label} />
      <button
        type="button"
        onClick={toggle}
        className="absolute bottom-4 right-4 grid size-10 place-items-center rounded-full bg-ink/50 text-cream transition hover:bg-ink/75"
        aria-label={playing ? "Pause video" : "Play video"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="ml-0.5 size-4" fill="currentColor" aria-hidden><path d="M7 4.5v15l13-7.5Z" /></svg>
        )}
      </button>
    </>
  );
}
