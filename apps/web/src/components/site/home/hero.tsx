import Link from "next/link";
import type { StoreDTO } from "@/lib/types";
import { formatHours, istDayIndex } from "@seiketsu/core/store-hours";
import { CheckDeliveryButton, HeroVideo } from "./client";

export function Hero({ store }: { store: StoreDTO }) {
  const today = store.hours?.[istDayIndex(new Date())] ?? null;
  return (
    <section className="grid bg-berry text-cream md:min-h-[calc(100svh-4rem)] md:grid-cols-[1fr_1fr] lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative order-1 aspect-[4/5] max-h-[72svh] w-full overflow-hidden bg-berry-deep md:order-2 md:aspect-auto md:max-h-none">
        <HeroVideo src="/landing/hero.mp4" poster="/landing/hero-poster.webp" label="Seiketsu reel: sandwiches, wraps and bowls, the art of clean eating" />
      </div>

      <div className="order-2 flex flex-col justify-between gap-12 px-6 py-12 sm:px-10 md:order-1 md:py-14 lg:py-16 lg:pl-[max(4rem,calc((100vw-72rem)/2+1.5rem))] lg:pr-16">
        <p className="text-sm text-cream/70">Versova, Mumbai</p>

        <div className="space-y-8">
          <h1 className="max-w-[11ch] font-display text-[clamp(3rem,6.4vw,6.25rem)] font-medium leading-[0.95] tracking-[-0.025em]">
            The art of clean eating.
          </h1>
          <p className="max-w-[34ch] text-lg leading-relaxed text-cream/85">
            A premium nutrition fresh house. Salads, wraps, bowls, cold-pressed juices and smoothies, made to order, with the
            nutrition on every dish.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/menu" className="rounded-full bg-cream px-7 py-3.5 font-semibold text-berry transition hover:bg-butter">
              Order now
            </Link>
            <CheckDeliveryButton className="inline-flex items-center gap-2 rounded-full border border-cream/40 px-6 py-3.5 font-semibold text-cream transition hover:border-cream hover:bg-cream/10" />
          </div>
        </div>

        <p className="text-sm text-cream/70">
          {store.isOpenNow ? (
            <>Open today{today ? ` · ${formatHours(today)}` : ""}</>
          ) : store.hours ? (
            "Closed right now. Order when we open."
          ) : (
            "Online ordering opens soon."
          )}
        </p>
      </div>
    </section>
  );
}
