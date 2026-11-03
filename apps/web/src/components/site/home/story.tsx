import Image from "next/image";
import { Bowl, Broccoli, Crate, Farm, Sparkle } from "./doodles";

export function Story() {
  return (
    <section id="story" className="scroll-mt-20 bg-cream" aria-labelledby="story-h">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-24 sm:px-6 md:grid-cols-2">
        <div className="relative order-2 md:order-1">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border-[6px] border-white shadow-[var(--shadow-lift)]">
            <Image src="/landing/cafe-sign.webp" alt="The illuminated Seiketsu sign on the red brick wall of our Versova kitchen" fill sizes="(min-width: 768px) 540px, 92vw" className="object-cover" />
          </div>
          <div className="absolute -bottom-10 right-2 w-36 rotate-6 sm:-right-4 sm:w-48 overflow-hidden rounded-2xl border-[5px] border-white shadow-xl sm:w-48">
            <Image src="/landing/cafe-menu-card.webp" alt="The Seiketsu menu card decorated with marigolds" width={240} height={320} className="h-auto w-full" />
          </div>
          <Broccoli className="absolute -left-6 -top-10 w-20 -rotate-12" />
        </div>
        <div className="order-1 space-y-6 md:order-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive-ink">01 · Why Seiketsu exists</p>
          <h2 id="story-h" data-reveal className="font-display text-5xl leading-[1.02] text-berry sm:text-6xl">
            We live in a world of food <em className="italic">extremes.</em>
          </h2>
          <div data-reveal className="space-y-4 text-lg leading-relaxed text-ink/75">
            <p>
              Convenient food often prioritises speed over nutritional value. Meanwhile, healthy food can feel restrictive, repetitive or
              disconnected from the pleasure of eating. Seiketsu was created to bridge that gap.
            </p>
            <p>
              Inspired by the Japanese concept of cleanliness and purity, the brand believes that better nourishment begins with thoughtful
              choices, from the ingredients we use to the way we prepare and experience food.
            </p>
          </div>
          <p data-reveal className="flex items-center gap-3 font-display text-2xl italic text-ink">
            <Sparkle className="size-5 text-orange" /> Clean eating is not a restriction. It is a conscious lifestyle choice.
          </p>
        </div>
      </div>
    </section>
  );
}

const JOURNEY = [
  { n: "01", verb: "Grow", name: "Arkoun HydroFarms", body: "Future-ready farming systems designed to grow food efficiently and thoughtfully.", Art: Farm },
  { n: "02", verb: "Source", name: "Arkoun Fresh", body: "Fresh produce brought closer to consumers and professional kitchens.", Art: Crate },
  { n: "03", verb: "Nourish", name: "Seiketsu", body: "Fresh ingredients transformed into thoughtfully prepared meals and a premium everyday food experience.", Art: Bowl },
];

export function Journey() {
  return (
    <section className="relative overflow-hidden bg-olive-ink text-cream" aria-labelledby="journey-h">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-butter">Part of Arkoun’s food journey</p>
        <h2 id="journey-h" data-reveal className="mt-3 max-w-3xl font-display text-4xl leading-[1.04] sm:text-5xl">
          From how food is grown to how it is <em className="italic text-butter">experienced.</em>
        </h2>

        <div data-reveal className="relative mt-12">
          {/* The line that ties the three together draws itself in as the section appears. */}
          <svg aria-hidden className="absolute left-[16.6%] top-6 hidden h-20 w-[66.8%] md:block" viewBox="0 0 600 100" preserveAspectRatio="none">
            <path className="draw-path" pathLength={1} d="M0 50 C 90 -10, 210 110, 300 50 S 510 -10, 600 50" fill="none" stroke="#fce9ab" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span aria-hidden className="absolute bottom-0 left-[2.75rem] top-0 w-px bg-cream/25 md:hidden" />
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
            {JOURNEY.map(({ n, verb, name, body, Art }) => (
              <li key={n} className="relative grid grid-cols-[5.5rem_1fr] gap-5 md:block md:text-center">
                <div className="relative mx-auto grid size-[5.5rem] place-items-center rounded-full bg-cream shadow-[0_0_0_8px_rgb(255_252_245/0.08)] md:size-32">
                  <Art className="w-14 md:w-24" />
                </div>
                <div>
                  <p className="flex items-baseline gap-3 md:mt-5 md:justify-center">
                    <span className="font-display text-5xl leading-none text-transparent [-webkit-text-stroke:1px_rgb(252_233_171/0.7)]">{n}</span>
                    <span className="text-xs font-bold tracking-[0.25em] text-butter">{verb.toUpperCase()}</span>
                  </p>
                  <h3 className="mt-1 font-display text-3xl">{name}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-cream/75">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="mx-auto mt-12 max-w-2xl border-t border-cream/20 pt-6 text-center font-display text-xl italic leading-snug text-cream/90">
          Together, these verticals connect the journey from how food is grown to how it is experienced and consumed.
        </p>
      </div>
    </section>
  );
}
