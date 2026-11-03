"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

const PEOPLE = [
  {
    who: "The Busy Professional",
    title: "Eat Well, Even on Your Busiest Days.",
    body: "Fresh, convenient and satisfying meals that fit into your workday without compromising on what you eat.",
    wants: ["Make better everyday food choices", "Find convenient meal options", "Enjoy something fresh between meetings"],
    img: "/art/grilled_wrap.webp",
    tone: "bg-butter",
  },
  {
    who: "The Fitness Enthusiast",
    title: "Fuel Your Day with Better Choices.",
    body: "Thoughtfully prepared meals and refreshing blends that complement an active lifestyle.",
    wants: ["Add more nutrients to your diet", "Explore balanced meal options", "Find satisfying post-workout meals"],
    img: "/art/orange_juice_bottle.webp",
    tone: "bg-orange/20",
  },
  {
    who: "The Health-Conscious Eater",
    title: "Make Everyday Nutrition Enjoyable.",
    body: "Fresh ingredients and wholesome combinations that make eating well feel less like a routine and more like a lifestyle.",
    wants: ["Eat more fresh vegetables", "Make mindful food choices", "Enjoy variety without compromising on flavour"],
    img: "/art/green_pasta_bowl.webp",
    tone: "bg-olive/20",
  },
  {
    who: "The Everyday Food Lover",
    title: "Fresh Food. Full of Flavour.",
    body: "Discover exciting combinations, delicious ingredients and meals that make you look forward to eating well.",
    wants: ["Explore new flavours", "Enjoy fresh and wholesome meals", "Find something delicious for every craving"],
    img: "/art/sandwich_on_plate.webp",
    tone: "bg-pink/15",
  },
];

/** "Built for your lifestyle": pick who you are, see what Seiketsu offers you. */
export function Lifestyle() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const p = PEOPLE[active];

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + PEOPLE.length) % PEOPLE.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section id="lifestyle" className="scroll-mt-20 bg-cream" aria-labelledby="life-h">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive-ink">Built for your lifestyle</p>
            <h2 id="life-h" data-reveal className="mt-2 font-display text-4xl leading-[1.04] text-ink sm:text-5xl">
              Good Food for Every <em className="italic text-berry">Kind of You.</em>
            </h2>
          </div>
          <p data-reveal className="max-w-md text-ink/70 md:justify-self-end">
            Eating well looks different for everyone. Whether you’re balancing a busy schedule, following an active lifestyle or simply
            looking for fresher food choices, Seiketsu brings good food closer to your everyday routine.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[0.75fr_1.25fr]">
          <div className="min-w-0">
            <div role="tablist" aria-label="Choose what fits you" aria-orientation="vertical" onKeyDown={onKey} className="no-scrollbar relative -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-col md:gap-0 md:overflow-visible md:border-t md:border-ink/15 md:px-0">
              {PEOPLE.map((x, i) => {
                const on = i === active;
                return (
                  <button
                    key={x.who}
                    ref={(el) => {
                      tabs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`life-tab-${i}`}
                    aria-selected={on}
                    aria-controls="life-panel"
                    tabIndex={on ? 0 : -1}
                    onClick={() => setActive(i)}
                    className={`group flex shrink-0 items-baseline gap-3 rounded-full border px-4 py-2 text-left transition md:rounded-none md:border-0 md:border-b md:border-ink/15 md:px-0 md:py-4 ${
                      on ? "border-berry bg-berry text-cream md:bg-transparent md:text-ink" : "border-line text-ink/60 hover:text-ink"
                    }`}
                  >
                    <span className={`hidden font-display text-sm tabular md:inline ${on ? "text-berry" : "text-ink/35"}`}>0{i + 1}</span>
                    <span className="whitespace-nowrap font-display text-lg md:text-2xl">{x.who}</span>
                    <span aria-hidden className={`ml-auto hidden text-berry transition md:inline ${on ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"}`}>→</span>
                  </button>
                );
              })}
            </div>
            <Link href="/#favourites" className="mt-6 hidden items-center gap-2 font-semibold text-berry hover:underline md:inline-flex">
              Find your favourite →
            </Link>
          </div>

          <div id="life-panel" role="tabpanel" aria-labelledby={`life-tab-${active}`} className={`relative grid overflow-hidden rounded-[2rem] p-6 transition-colors duration-500 sm:grid-cols-[1.2fr_0.8fr] sm:p-8 ${p.tone}`}>
            <div key={active} className="animate-toast-in space-y-4">
              <h3 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{p.title}</h3>
              <p className="text-ink/75">{p.body}</p>
              <div>
                <p className="text-sm font-semibold text-ink">Ideal if you want to:</p>
                <ul className="mt-2 space-y-2">
                  {p.wants.map((w) => (
                    <li key={w} className="flex items-start gap-2.5 text-ink/80">
                      <span aria-hidden className="mt-1 grid size-4 shrink-0 place-items-center rounded-full bg-berry text-[10px] text-cream">✓</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div aria-hidden className="relative mt-6 h-44 sm:mt-0 sm:h-auto">
              {PEOPLE.map((x, i) => (
                <Image
                  key={x.img}
                  src={x.img}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 260px, 60vw"
                  className={`object-contain mix-blend-multiply transition duration-700 ease-out ${i === active ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
                />
              ))}
            </div>
          </div>
        </div>
        <Link href="/#favourites" className="mt-6 inline-flex items-center gap-2 font-semibold text-berry hover:underline md:hidden">
          Find your favourite →
        </Link>
      </div>
    </section>
  );
}
