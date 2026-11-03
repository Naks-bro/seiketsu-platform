"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const PAIRS = [
  { a: "Nutrition", b: "Taste", img: "/art/green_pasta_bowl.webp", tone: "bg-olive/25" },
  { a: "Freshness", b: "Convenience", img: "/art/orange_juice_bottle.webp", tone: "bg-orange/25" },
  { a: "Wellbeing", b: "Enjoyment", img: "/art/fruit_bowl.webp", tone: "bg-pink/20" },
  { a: "Quality", b: "Everyday Accessibility", img: "/art/grilled_wrap.webp", tone: "bg-butter" },
];
const STEP = 3800;

/** The brand promise as one compact, self-advancing showcase: pick a pair, see it on the plate. */
export function BrandPromise() {
  const [active, setActive] = useState(0);
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (hold || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setActive((i) => (i + 1) % PAIRS.length), STEP);
    return () => clearTimeout(t);
  }, [active, hold]);

  const cur = PAIRS[active];
  return (
    <section className="bg-cream" aria-labelledby="promise-h">
      <div
        className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1fr_0.9fr] md:py-20"
        onMouseEnter={() => setHold(true)}
        onMouseLeave={() => setHold(false)}
        onFocus={() => setHold(true)}
        onBlur={() => setHold(false)}
      >
        <div>
          <h2 id="promise-h" className="font-display text-5xl leading-[1.02] text-ink sm:text-6xl">
            Cleaner choices.
            <br />
            <em className="italic text-berry">Better experiences.</em>
          </h2>
          <p className="mt-4 max-w-sm text-ink/70">Seiketsu brings together the things people often have to choose between:</p>
          <ul className="mt-8 border-t border-ink/15" role="list">
            {PAIRS.map((p, i) => {
              const on = i === active;
              return (
                <li key={p.a} className="border-b border-ink/15">
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-pressed={on}
                    className="group relative flex w-full items-baseline gap-3 py-3.5 text-left"
                  >
                    <span className={`font-display text-2xl transition-colors sm:text-3xl ${on ? "text-ink" : "text-ink/35 group-hover:text-ink/70"}`}>{p.a}</span>
                    <span className={`inline-block font-display text-xl transition duration-500 ${on ? "rotate-90 text-berry" : "text-ink/30"}`} aria-hidden>×</span>
                    <span className={`font-display text-2xl italic transition-colors sm:text-3xl ${on ? "text-berry" : "text-ink/35 group-hover:text-berry/70"}`}>{p.b}</span>
                    {on && !hold && (
                      <span aria-hidden key={active} className="absolute bottom-[-1px] left-0 h-0.5 w-full origin-left animate-[grow_3.8s_linear] bg-berry" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 max-w-md font-display text-lg italic text-ink/70">
            Because eating thoughtfully should never mean compromising on the pleasure of food.
          </p>
        </div>

        <div className={`relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[2rem] transition-colors duration-700 md:max-h-[34rem] ${cur.tone}`} aria-hidden>
          {PAIRS.map((p, i) => (
            <Image
              key={p.img}
              src={p.img}
              alt=""
              fill
              sizes="(min-width: 768px) 384px, 90vw"
              className={`object-contain p-8 mix-blend-multiply transition duration-700 ease-out ${i === active ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
            />
          ))}
          <div className="absolute inset-x-0 bottom-0 p-6">
            <p key={active} className="animate-toast-in font-display text-3xl leading-tight text-ink">
              {cur.a} <span className="text-berry">×</span> <em className="italic text-berry">{cur.b}</em>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
