"use client";

import { useScene, useStoryMode } from "./scroll";

const NOT = ["Restrictive diets", "Following food trends"];
const IS = ["Making thoughtful choices", "Enjoying what you eat", "Finding a balance that works for your lifestyle"];
const STEPS = 7;

/** "The Seiketsu promise". On wide screens it pins: the old ideas get struck out, then the three arrive one by one. */
export function SeiketsuPromise() {
  const story = useStoryMode();
  const { ref, step } = useScene<HTMLElement>(STEPS, story);
  const at = (s: number) => !story || step >= s;

  return (
    <section ref={ref} className="relative bg-butter" style={story ? { height: "300svh" } : undefined} aria-labelledby="promise-h">
      <div className={story ? "sticky top-16 flex h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden" : ""}>
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-8">
          <div className="grid gap-10 md:grid-cols-2 md:gap-14">
            <div className="space-y-5">
              <p className="text-sm font-semibold text-olive-ink">The Seiketsu promise</p>
              <h2 id="promise-h" className="font-display text-4xl leading-[1.04] text-ink sm:text-5xl">
                Not Another Healthy Food Place.
                <br />
                <em className="italic text-berry">A Better Food Habit.</em>
              </h2>
              <p className="max-w-md text-lg text-ink/75">We don’t believe eating well should feel like a compromise.</p>
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
