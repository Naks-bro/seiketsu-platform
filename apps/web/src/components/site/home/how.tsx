"use client";

import Image from "next/image";
import { useMotionOk, useScene } from "./scroll";

/** A cut-out of one of our dishes and the angle it rests at. Files are trimmed to the dish, so equal boxes look equal. */
type Dish = { src: string; turn: number };

const STEPS: { n: string; title: string; body: string; main: Dish; side: Dish }[] = [
  {
    n: "01",
    title: "Thoughtful Sourcing",
    body: "We focus on selecting quality ingredients that form the foundation of good food.",
    main: { src: "/cut/broccoli-corn-salad-bowl.webp", turn: 8 },
    side: { src: "/cut/cucumber-and-avocado-salad-bowl.webp", turn: -10 },
  },
  {
    n: "02",
    title: "Fresh Preparation",
    body: "Our meals are prepared with attention to freshness, quality and consistency.",
    main: { src: "/cut/avocado-toast.webp", turn: -6 },
    side: { src: "/cut/fruit-bowl.webp", turn: 10 },
  },
  {
    n: "03",
    title: "Balanced Combinations",
    body: "We bring ingredients together to create meals that balance flavour, variety and nutrition.",
    main: { src: "/cut/salad-bowl.webp", turn: 6 },
    side: { src: "/cut/italian-pesto-pasta-bowl.webp", turn: -10 },
  },
  {
    n: "04",
    title: "Made for You",
    body: "Freshly prepared for you according to your needs and ready to fit into your day, wherever you are.",
    main: { src: "/cut/tandoori-grill.webp", turn: -6 },
    side: { src: "/cut/green-pasta-bowl.webp", turn: 12 },
  },
];

/** The same two boxes for every step: a large dish at the right edge and a smaller one below it. */
const MAIN_BOX = "-right-[4%] top-[18%] size-[min(38vw,62svh,500px)] max-md:right-auto max-md:left-[19vw] max-md:top-[29%] max-md:size-[62vw]";
const SIDE_BOX = "right-[30%] bottom-[4%] size-[min(17vw,28svh,230px)] max-md:hidden";

function Art({ dish, sizes }: { dish: Dish; sizes: string }) {
  return <Image src={dish.src} alt="" fill sizes={sizes} className="object-contain drop-shadow-2xl" />;
}

/**
 * "How we make it better" as a scroll-told story. The scene pins; each step's words take the stage while its
 * dishes drift in from the edges and leave as the next step arrives.
 */
export function HowWeMakeIt() {
  const story = useMotionOk();
  const { ref, step } = useScene<HTMLElement>(STEPS.length, story);

  const intro = (
    <>
      <p className="text-sm font-semibold text-butter">How we make it better</p>
      <h2 id="how-h" className="mt-3 max-w-2xl font-display text-3xl leading-[1.04] sm:text-5xl">
        From Thoughtful Ingredients to <em className="italic text-butter">Feel-Good Meals.</em>
      </h2>
      <p className="mt-3 max-w-md text-sm text-cream/75 sm:mt-4 sm:text-base">Every Seiketsu meal begins with an idea: eating well should be simple, enjoyable and accessible.</p>
    </>
  );

  if (!story) {
    return (
      <section id="how" className="relative scroll-mt-20 overflow-hidden bg-olive-ink text-cream" aria-labelledby="how-h">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          {intro}
          <ol className="mt-12 space-y-14">
            {STEPS.map((s) => (
              <li key={s.n} className="relative min-h-44">
                <div aria-hidden className="pointer-events-none absolute -right-12 top-1/2 size-44 -translate-y-1/2 sm:-right-4 sm:size-60" style={{ rotate: `${s.main.turn}deg` }}>
                  <Art dish={s.main} sizes="240px" />
                </div>
                <div className="relative max-w-[62%] sm:max-w-md">
                  <p aria-hidden className="font-display text-6xl leading-none text-cream/20">{s.n}</p>
                  <h3 className="-mt-6 font-display text-3xl leading-tight">{s.title}</h3>
                  <p className="mt-2 text-cream/80">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} id="how" className="relative scroll-mt-20 bg-olive-ink text-cream" style={{ height: `${STEPS.length * 85 + 40}svh` }} aria-labelledby="how-h">
      <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden">
        {/* The dishes: no frames; they come in from the edges and rest half off the screen. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {STEPS.map((s, i) =>
            ([
              [s.main, MAIN_BOX, "translate(50vw, 0)", "(min-width: 768px) 500px, 68vw"],
              [s.side, SIDE_BOX, "translate(0, 60vh)", "230px"],
            ] as const).map(([dish, box, from, sizes], j) => {
              const on = i === step;
              const past = i < step;
              return (
                <div
                  key={`${s.n}-${j}`}
                  className={`absolute ${box} transition-[transform,opacity] duration-[900ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]`}
                  style={{
                    transform: on ? `translate(0, 0) rotate(${dish.turn}deg)` : past ? `translate(0, -40vh) rotate(${dish.turn - 20}deg)` : `${from} rotate(${dish.turn + 25}deg)`,
                    opacity: on ? 1 : 0,
                    transitionDelay: on ? `${j * 90}ms` : "0ms",
                  }}
                >
                  <Art dish={dish} sizes={sizes} />
                </div>
              );
            }),
          )}
        </div>

        <div className="relative mx-auto flex h-full max-w-6xl flex-col px-4 pb-6 pt-8 sm:px-6 md:pb-10 md:pt-12">
          <div>{intro}</div>

          {/* The words: one step at a time, large. */}
          <div className="relative mt-auto mb-6 grid md:my-auto">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                aria-hidden={i !== step}
                className={`col-start-1 row-start-1 max-w-[17rem] transition-[transform,opacity] duration-700 sm:max-w-md ${i === step ? "translate-y-0 opacity-100" : i < step ? "-translate-y-8 opacity-0" : "translate-y-8 opacity-0"}`}
              >
                <p className="font-display text-[4.5rem] leading-none text-cream/15 md:text-[7rem]">{s.n}</p>
                <h3 className="-mt-7 font-display text-4xl leading-[1.05] md:-mt-10 md:text-5xl lg:text-6xl">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-cream/80 md:mt-4 md:text-xl">{s.body}</p>
              </div>
            ))}
          </div>

          {/* Where you are in the story. */}
          <ol aria-hidden className="flex gap-5 text-sm">
            {STEPS.map((s, i) => (
              <li key={s.n} className={`flex items-center gap-2 transition-opacity duration-500 ${i === step ? "opacity-100" : "opacity-45"}`}>
                <span className="tabular">{s.n}</span>
                <span className="relative h-px w-10 overflow-hidden bg-cream/25">
                  <span className={`absolute inset-0 origin-left bg-butter transition-transform duration-500 ${i <= step ? "scale-x-100" : "scale-x-0"}`} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
