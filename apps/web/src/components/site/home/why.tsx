"use client";

import Image from "next/image";
import Link from "next/link";
import { useScene, useStoryMode } from "./scroll";

const REASONS = [
  { title: "Hydroponically Grown Produce", body: "Vegetables grown through controlled hydroponic farming, bringing the freshness of modern agriculture closer to your plate.", img: "/landing/why-hydroponic.webp", alt: "Picking basil in the hydroponic greenhouse", tone: "bg-olive/20" },
  { title: "Thoughtful Ingredients", body: "A focus on selecting quality ingredients and bringing them together with care.", img: "/landing/why-ingredients.webp", alt: "Trays of freshly chopped peppers, tomatoes and cucumber", tone: "bg-butter" },
  { title: "Freshly Prepared", body: "Meals prepared to order, with attention to freshness, flavour and consistency.", img: "/landing/why-prepared.webp", alt: "Fresh vegetables added to bowls by gloved hands", tone: "bg-pink/15" },
  { title: "Nutrition Meets Flavour", body: "Wholesome food that makes eating better enjoyable, never restrictive.", img: "/menu/healthy-quinoa-salad-bowl.webp", alt: "Healthy Quinoa Salad Bowl", tone: "bg-orange/20" },
  { title: "Everyday Convenience", body: "Fresh food choices that fit into your routine, wherever your day takes you.", img: "/menu/tandoori-wrap-paneer-chicken.webp", alt: "Tandoori Wrap", tone: "bg-berry/10" },
  { title: "Variety for Every Craving", body: "From vibrant salads to satisfying wraps and refreshing smoothies, there’s something for every appetite.", img: "/landing/poster-bottles-salads.webp", alt: "Seiketsu wraps, pasta, toast and fresh-pressed juices", tone: "bg-olive/15" },
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
            {REASONS.map(({ title, body, img, alt, tone }, i) => (
              <article key={title} className={`relative flex h-[28rem] w-[21rem] shrink-0 flex-col overflow-hidden rounded-[2rem] p-3 ${tone}`}>
                <div className="relative h-64 shrink-0 overflow-hidden rounded-[1.5rem]">
                  <Image src={img} alt={alt} fill sizes="320px" className="object-cover" />
                  <span aria-hidden className="absolute left-3 top-3 rounded-full bg-cream/90 px-2.5 py-1 text-xs font-semibold tabular text-ink">0{i + 1}</span>
                </div>
                <div className="flex flex-1 flex-col px-4 pb-4">
                <h3 className="mt-auto font-display text-2xl leading-tight text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/70">{body}</p>
                </div>
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
            {REASONS.map(({ title, body, img, alt }) => (
              <li key={title} data-reveal className="flex gap-4 border-t border-ink/15 py-5">
                <span className="relative size-20 shrink-0 overflow-hidden rounded-2xl">
                  <Image src={img} alt={alt} fill sizes="80px" className="object-cover" />
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
