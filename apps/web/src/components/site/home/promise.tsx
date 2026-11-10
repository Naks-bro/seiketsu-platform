"use client";

import Image from "next/image";
import { usePlayOnSeen, useScene, useStoryMode } from "./scroll";

const NOT = ["Restrictive diets", "Following food trends"];
const IS = ["Making thoughtful choices", "Enjoying what you eat", "Finding a balance that works for your lifestyle"];
const STEPS = 7;
/** Owner photos that arrive with the three ideas, fanned like prints on a table. */
const PRINTS = [
  { src: "/landing/promise-juices.webp", alt: "Seiketsu fresh-pressed juices", turn: -8, x: "0%" },
  { src: "/landing/promise-sandwiches.webp", alt: "Sandwiches from the Seiketsu kitchen", turn: 4, x: "38%" },
  { src: "/landing/promise-wrap.webp", alt: "A Seiketsu wrap with salsa", turn: -3, x: "76%" },
];

/** "The Seiketsu promise". On wide screens it pins: the old ideas get struck out, then the three arrive one by one. */
export function SeiketsuPromise() {
  const story = useStoryMode();
  const { ref, step } = useScene<HTMLElement>(STEPS, story);
  const { ref: playRef, played } = usePlayOnSeen<HTMLDivElement>(STEPS);
  const at = (s: number) => (story ? step >= s : played >= s);

  return (
    <section ref={ref} className="relative bg-butter" style={story ? { height: "300svh" } : undefined} aria-labelledby="promise-h">
      <div className={story ? "sticky top-16 flex h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden" : ""}>
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-8">
          <div ref={playRef} className="grid gap-10 md:grid-cols-2 md:gap-14">
            <div className="space-y-5">
              <p className="text-sm font-semibold text-olive-ink">The Seiketsu promise</p>
              <h2 id="promise-h" className="font-display text-4xl leading-[1.04] text-ink sm:text-5xl">
                Not Another Healthy Food Place.
                <br />
                <em className="italic text-berry">A Better Food Habit.</em>
              </h2>
              <p className="max-w-md text-lg text-ink/75">We don’t believe eating well should feel like a compromise.</p>
              {story ? (
                <div className="relative h-56 max-w-md lg:h-64">
                  {PRINTS.map((x, i) => (
                    <div
                      key={x.src}
                      className="absolute top-0 aspect-[4/5] h-full overflow-hidden rounded-2xl border-4 border-white shadow-[var(--shadow-card)] transition-[transform,opacity] duration-700 ease-out"
                      style={{
                        left: x.x,
                        transform: at(3 + i) ? `translateX(-${i * 18}%) rotate(${x.turn}deg)` : `translateY(40%) rotate(${x.turn * 3}deg)`,
                        opacity: at(3 + i) ? 1 : 0,
                        zIndex: i,
                      }}
                    >
                      <Image src={x.src} alt={x.alt} fill sizes="220px" className="object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="grid max-w-md grid-cols-3 gap-2.5 pt-2">
                  {PRINTS.map((x, i) => (
                    <li
                      key={x.src}
                      className="relative aspect-[4/5] overflow-hidden rounded-xl border-[3px] border-white shadow-[var(--shadow-card)] transition-[transform,opacity] duration-700 ease-out"
                      style={{ rotate: `${x.turn / 2}deg`, opacity: at(3 + i) ? 1 : 0, transform: at(3 + i) ? "none" : "translateY(30%) scale(0.9)" }}
                    >
                      <Image src={x.src} alt={x.alt} fill sizes="(min-width: 640px) 150px, 30vw" className="object-cover" />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-ink/60">It’s not about</p>
                <ul className="mt-1">
                  {NOT.map((t, i) => (
                    <li key={t} className={`font-display text-2xl transition-colors duration-500 sm:text-3xl ${at(i + 1) ? "text-ink/35" : "text-ink"}`}>
                      <span className="relative">
                        {t}
                        <span aria-hidden className="absolute left-0 top-1/2 h-[3px] w-full origin-left rounded-full bg-berry transition-transform duration-500 ease-out" style={{ transform: `scaleX(${at(i + 1) ? 1 : 0})` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`transition duration-500 ${at(3) ? "opacity-100" : "opacity-0"}`}>
                <p className="text-sm font-semibold text-ink/60">It’s about</p>
                <ol className="mt-2 space-y-2">
                  {IS.map((t, i) => (
                    <li key={t} className={`flex items-baseline gap-4 transition duration-500 ${at(3 + i) ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"}`}>
                      <span className="font-display text-lg tabular text-berry">0{i + 1}</span>
                      <span className="font-display text-2xl leading-tight text-ink sm:text-3xl">{t}</span>
                    </li>
                  ))}
                </ol>
                <p className={`mt-4 text-ink/75 transition duration-500 ${at(5) ? "opacity-100" : "opacity-0"}`}>At Seiketsu, we make room for all three.</p>
              </div>
            </div>
          </div>
          <p
            className={`mt-12 border-t border-ink/15 pt-8 text-center font-display text-3xl text-berry transition duration-700 ease-out sm:text-5xl ${
              at(6) ? "scale-100 opacity-100" : "scale-90 opacity-0"
            }`}
          >
            Good Food. <em className="italic">Good Choices.</em> Good Living.
          </p>
        </div>
      </div>
    </section>
  );
}
