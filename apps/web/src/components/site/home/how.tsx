"use client";

import { Bowl, Broccoli, Crate, Scooter } from "./doodles";
import { useScene, useStoryMode } from "./scroll";

const STEPS = [
  { n: "01", title: "Thoughtful Sourcing", body: "We focus on selecting quality ingredients that form the foundation of good food.", Art: Crate },
  { n: "02", title: "Fresh Preparation", body: "Our meals are prepared with attention to freshness, quality and consistency.", Art: Broccoli },
  { n: "03", title: "Balanced Combinations", body: "We bring ingredients together to create meals that balance flavour, variety and nutrition.", Art: Bowl },
  { n: "04", title: "Made for You", body: "Freshly prepared for you according to your needs and ready to fit into your day, wherever you are.", Art: Scooter },
];

/** "How we make it better". On wide screens it pins: the line draws as you scroll and each step lights up when reached. */
export function HowWeMakeIt() {
  const story = useStoryMode();
  const { ref, step } = useScene<HTMLElement>(STEPS.length + 1, story);
  const lit = (i: number) => !story || step > i;

  return (
    <section ref={ref} id="how" className="relative scroll-mt-20 bg-olive-ink text-cream" style={story ? { height: "280svh" } : undefined} aria-labelledby="how-h">
      <div className={story ? "sticky top-16 flex h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden" : ""}>
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-8">
          <p className="text-sm font-semibold text-butter">How we make it better</p>
          <h2 id="how-h" className="mt-3 max-w-3xl font-display text-4xl leading-[1.04] sm:text-5xl">
            From Thoughtful Ingredients to <em className="italic text-butter">Feel-Good Meals.</em>
          </h2>
          <p className="mt-4 max-w-xl text-cream/75">Every Seiketsu meal begins with an idea: eating well should be simple, enjoyable and accessible.</p>

          <div className="relative mt-12">
            <svg aria-hidden className="absolute left-[12.5%] top-4 hidden h-16 w-[75%] md:block" viewBox="0 0 800 100" preserveAspectRatio="none">
              <path d="M0 50 C 80 -10, 190 110, 266 50 S 450 -10, 533 50 S 720 110, 800 50" fill="none" stroke="rgb(252 233 171 / 0.18)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <path
                pathLength={1}
                d="M0 50 C 80 -10, 190 110, 266 50 S 450 -10, 533 50 S 720 110, 800 50"
                fill="none"
                stroke="#fce9ab"
                strokeWidth="2.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ strokeDasharray: 1, strokeDashoffset: story ? "calc(1 - min(1, var(--p, 0) * 1.25))" : 0 }}
              />
            </svg>
            <span aria-hidden className="absolute bottom-0 left-[2.75rem] top-0 w-px bg-cream/25 md:hidden" />
            <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
              {STEPS.map(({ n, title, body, Art }, i) => (
                <li key={n} className="relative grid grid-cols-[5.5rem_1fr] gap-5 md:block md:text-center">
                  {/* A solid green disc sits under each icon so the line always passes behind it. */}
                  <div className="relative mx-auto size-[5.5rem] rounded-full bg-olive-ink md:size-28">
                    <div
                      className={`grid size-full place-items-center rounded-full shadow-[0_0_0_8px_rgb(255_252_245/0.08)] transition duration-700 ${
                        lit(i) ? "scale-100 bg-cream" : "scale-90 bg-cream/20"
                      }`}
                    >
                      <Art className={`w-14 transition duration-700 md:w-20 ${lit(i) ? "rotate-0 opacity-100" : "-rotate-12 opacity-40"}`} />
                    </div>
                  </div>
                  <div className={`transition duration-700 ${lit(i) ? "translate-y-0 opacity-100" : "translate-y-3 opacity-35"}`}>
                    <p className="font-display text-4xl leading-none text-transparent [-webkit-text-stroke:1px_rgb(252_233_171/0.7)] md:mt-5">{n}</p>
                    <h3 className="mt-2 font-display text-2xl">{title}</h3>
                    <p className="mx-auto mt-2 max-w-[16rem] text-sm text-cream/75">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
