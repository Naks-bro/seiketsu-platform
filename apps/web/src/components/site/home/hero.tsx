import Link from "next/link";
import type { StoreDTO } from "@/lib/types";
import { formatHours, istDayIndex } from "@seiketsu/core/store-hours";
import { CheckDeliveryButton, HeroVideo } from "./client";
import { Avocado, Leaf, Lemon, Sparkle, SpinBadge, Tomato } from "./doodles";

export function Hero({ store }: { store: StoreDTO }) {
  const today = store.hours?.[istDayIndex(new Date())] ?? null;
  return (
    <section className="relative overflow-hidden bg-cream">
      <div aria-hidden className="pointer-events-none absolute -left-40 top-20 size-[30rem] rounded-full bg-butter/60 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-40 size-[26rem] rounded-full bg-pink/15 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:pt-16">
        <div className="space-y-7">
          <p data-reveal className="inline-flex items-center gap-2 rounded-full border border-berry/20 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-berry">
            <Sparkle className="size-3 text-orange" /> Premium nutrition fresh house · Versova
          </p>
          <h1 data-reveal style={{ "--d": "80ms" } as React.CSSProperties} className="font-display text-[clamp(3.2rem,9vw,7rem)] font-semibold uppercase leading-[0.86] tracking-[-0.02em] text-berry">
            The art
            <br />
            of <em className="font-normal lowercase italic text-pink">clean</em>
            <br />
            eating.
          </h1>
          <p data-reveal style={{ "--d": "160ms" } as React.CSSProperties} className="max-w-md text-lg leading-relaxed text-ink/75">
            <strong className="font-semibold text-ink">Nourishment, refined.</strong> Fresh salads, wraps, bowls, cold-pressed juices and smoothies, made to
            order in our Versova kitchen, with the nutrition on every dish.
          </p>
          <div data-reveal style={{ "--d": "240ms" } as React.CSSProperties} className="flex flex-wrap gap-3">
            <Link href="/menu" className="group inline-flex items-center gap-2 rounded-full bg-berry px-7 py-4 font-semibold text-cream shadow-[var(--shadow-float)] transition hover:-translate-y-0.5 hover:bg-berry-deep">
              Order now <span className="transition group-hover:translate-x-1" aria-hidden>→</span>
            </Link>
            <CheckDeliveryButton className="inline-flex items-center gap-2 rounded-full border-2 border-berry/25 bg-white/60 px-6 py-3.5 font-semibold text-berry transition hover:border-berry hover:bg-white" />
          </div>
          <p className="text-sm text-muted">
            {store.isOpenNow ? (
              <>
                <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-veg align-middle" />
                Open now{today ? ` · ${formatHours(today)}` : ""}
              </>
            ) : store.hours ? (
              "Closed right now. Browse the menu and order when we open."
            ) : (
              "Online ordering opens soon."
            )}
          </p>
        </div>

        <div className="relative mx-auto aspect-[4/5] w-full max-w-sm md:max-w-[440px]">
          <div aria-hidden className="absolute inset-4 rotate-3 rounded-[2.5rem] bg-berry" />
          <div className="absolute inset-0 -rotate-2 overflow-hidden rounded-[2.5rem] border-[6px] border-cream shadow-[var(--shadow-lift)]">
            <HeroVideo src="/landing/hero.mp4" poster="/landing/hero-poster.webp" label="Seiketsu reel: sandwiches, wraps and bowls, the art of clean eating" />
          </div>
          <Avocado className="animate-float pointer-events-none absolute -left-10 top-10 w-20 drop-shadow-md sm:-left-16 sm:w-24" style={{ "--r": "-14deg" } as React.CSSProperties} />
          <Tomato className="animate-float pointer-events-none absolute -right-6 top-1/3 w-16 [animation-delay:1.2s] sm:-right-12 sm:w-20" />
          <Leaf className="animate-float pointer-events-none absolute -bottom-6 left-6 w-16 [animation-delay:.6s] sm:w-20" style={{ "--r": "18deg" } as React.CSSProperties} />
          <Lemon className="animate-float pointer-events-none absolute -bottom-8 right-16 w-14 [animation-delay:2s]" />
          <SpinBadge text="MADE FRESH · EVERY DAY · TO ORDER · " className="pointer-events-none absolute -right-4 -top-6 w-28 drop-shadow-lg sm:-right-10 sm:w-32" />
        </div>
      </div>
    </section>
  );
}
