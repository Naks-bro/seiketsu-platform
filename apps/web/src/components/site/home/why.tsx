"use client";

import Link from "next/link";
import { Avocado, Bowl, Broccoli, Farm, Leaf, Scooter } from "./doodles";
import { useScene, useStoryMode } from "./scroll";

const REASONS = [
  { title: "Hydroponically Grown Produce", body: "Vegetables grown through controlled hydroponic farming, bringing the freshness of modern agriculture closer to your plate.", Art: Farm, tone: "bg-olive/20" },
  { title: "Thoughtful Ingredients", body: "A focus on selecting quality ingredients and bringing them together with care.", Art: Leaf, tone: "bg-butter" },
  { title: "Freshly Prepared", body: "Meals prepared to order, with attention to freshness, flavour and consistency.", Art: Broccoli, tone: "bg-pink/15" },
  { title: "Nutrition Meets Flavour", body: "Wholesome food that makes eating better enjoyable, never restrictive.", Art: Avocado, tone: "bg-orange/20" },
  { title: "Everyday Convenience", body: "Fresh food choices that fit into your routine, wherever your day takes you.", Art: Scooter, tone: "bg-berry/10" },
  { title: "Variety for Every Craving", body: "From vibrant salads to satisfying wraps and refreshing smoothies, there’s something for every appetite.", Art: Bowl, tone: "bg-olive/15" },
];

function Intro() {
  return (
    <>
      <p className="text-sm font-semibold text-olive-ink">Why Seiketsu</p>
      <h2 id="why-h" className="mt-3 font-display text-4xl leading-[1.04] text-ink sm:text-5xl">
        Why Good Food Starts at the <em className="italic text-berry">Source.</em>
      </h2>
      <p className="mt-4 max-w-sm text-ink/70">We believe better food begins with better ingredients. That’s why our approach goes beyond the plate.</p>
      <Link href="/#how" className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream transition hover:bg-berry">
        Explore the Seiketsu experience
      </Link>
    </>
  );
}

/** "Why Seiketsu". On wide screens the section pins and the reasons travel sideways as you scroll down. */
export function WhySeiketsu() {
  const story = useStoryMode();
  const { ref } = useScene<HTMLElement>(1, story);

  return (
    <section ref={ref} id="why" className="relative scroll-mt-20 bg-paper" style={story ? { height: "300svh" } : undefined} aria-labelledby="why-h">
      {story ? (
        <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden">
          <div
            data-track
            className="flex w-max items-stretch gap-5 pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] pr-[12vw] will-change-transform"
            style={{ transform: "translate3d(calc(var(--p, 0) * var(--max, 0) * -1px), 0, 0)" }}
          >
            <div className="flex w-[25rem] shrink-0 flex-col justify-center pr-6">
              <Intro />
            </div>
            {REASONS.map(({ title, body, Art, tone }, i) => (
              <article key={title} className={`relative flex h-[26rem] w-[21rem] shrink-0 flex-col overflow-hidden rounded-[2rem] p-7 ${tone}`}>
                <span aria-hidden className="font-display text-6xl leading-none text-transparent [-webkit-text-stroke:1px_rgb(42_24_30/0.25)]">0{i + 1}</span>
                <span aria-hidden className="mt-4 grid size-28 place-items-center self-center rounded-full bg-cream/80">
                  <Art className="w-20" />
                </span>
                <h3 className="mt-auto font-display text-2xl leading-tight text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/70">{body}</p>
              </article>
            ))}
          </div>
          <div aria-hidden className="mx-auto mt-10 h-0.5 w-48 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full origin-left bg-berry" style={{ transform: "scaleX(var(--p, 0))" }} />
          </div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[0.8fr_1.2fr] md:gap-14">
          <div>
            <Intro />
          </div>
          <ul className="grid gap-x-8 sm:grid-cols-2">
            {REASONS.map(({ title, body, Art }) => (
              <li key={title} data-reveal className="flex gap-4 border-t border-ink/15 py-5">
                <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-cream">
                  <Art className="w-9" />
                </span>
                <div>
                  <h3 className="font-display text-xl leading-tight text-ink">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink/70">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
