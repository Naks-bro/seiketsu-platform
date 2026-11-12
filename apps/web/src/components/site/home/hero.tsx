import Link from "next/link";
import { HeroVideo } from "./client";
import { ScrollOut } from "./scroll";
import { LANDING_ONLY } from "@/lib/site-mode";

const REEL_URL = "https://www.instagram.com/sei_ketsu/reel/De9VjlEo1Ts/";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-berry text-cream">
      <ScrollOut />
      {/* One soft light behind the film, so it sits on the page rather than on a flat colour. */}
      <div aria-hidden className="pointer-events-none absolute -right-40 top-1/2 size-[44rem] -translate-y-1/2 rounded-full bg-pink/25 blur-[120px]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:min-h-[calc(100svh-4rem)] md:grid-cols-[1.05fr_0.95fr] md:gap-16 md:py-14">
        <div className="space-y-6" style={{ transform: "translate3d(0, calc(var(--h, 0) * 90px), 0)", opacity: "calc(1 - var(--h, 0) * 0.9)" }}>
          <h1 className="rise max-w-[11ch] font-display text-[clamp(3.1rem,6.6vw,6.5rem)] font-medium leading-[0.95] tracking-[-0.025em]">
            The art of clean eating.
          </h1>
          <p className="rise font-display text-2xl italic text-butter sm:text-3xl" style={{ "--d": "120ms" } as React.CSSProperties}>Eat Better. Feel Better. Live Better.</p>
          <div className="rise max-w-[46ch] space-y-3 leading-relaxed text-cream/85" style={{ "--d": "240ms" } as React.CSSProperties}>
            <p className="text-lg">
              Bringing together hydroponically grown greens and vegetables, fresh ingredients and thoughtfully crafted recipes, Seiketsu
              makes eating well an experience to look forward to.
            </p>
            <p className="text-cream/90">
              From wholesome salads and wraps to nourishing bowls, fresh-pressed juices and smoothies, discover a better way to eat every day.
            </p>
          </div>
          <div className="rise flex flex-wrap gap-3 pt-2" style={{ "--d": "360ms" } as React.CSSProperties}>
            <Link href="/#explore" className="rounded-full bg-cream px-8 py-4 font-semibold text-berry shadow-[0_12px_30px_-12px_rgb(0_0_0/0.5)] transition hover:-translate-y-0.5 hover:bg-butter">
              Explore our menu
            </Link>
            {!LANDING_ONLY && <Link href="/menu" className="rounded-full border border-cream/40 px-8 py-4 font-semibold text-cream transition hover:border-cream hover:bg-cream/10">
              Order now
            </Link>}
          </div>
        </div>

        <figure
          className="mx-auto w-full max-w-sm md:max-w-[min(100%,calc((100svh-10rem)*0.8))]"
          style={{ transform: "translate3d(0, calc(var(--h, 0) * -60px), 0) scale(calc(1 - var(--h, 0) * 0.08)) rotate(calc(var(--h, 0) * -2deg))" }}
        >
          <div className="rise relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-berry-deep shadow-[0_40px_90px_-35px_rgb(0_0_0/0.7)] ring-1 ring-cream/15">
            <HeroVideo src="/landing/hero.mp4" poster="/landing/hero-poster.webp" label="Seiketsu reel: sandwiches, wraps and bowls, the art of clean eating" />
          </div>
          <figcaption className="mt-3 flex items-center justify-between text-xs text-cream/90">
            <span>@sei_ketsu</span>
            <a href={REEL_URL} target="_blank" rel="noreferrer" className="font-medium text-cream/85 underline-offset-4 hover:text-cream hover:underline">
              Watch on Instagram
            </a>
          </figcaption>
        </figure>
      </div>
      <a href="#lifestyle" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[11px] text-cream/90 hover:text-cream md:flex">
        Scroll
        <span aria-hidden className="relative h-10 w-px overflow-hidden bg-cream/25">
          <span className="absolute inset-x-0 top-0 h-1/2 animate-[scroll-cue_1.8s_ease-in-out_infinite] bg-cream" />
        </span>
      </a>
    </section>
  );
}
