"use client";

import Image from "next/image";
import { useScene, useStoryMode } from "./scroll";

/** One element of a scene: a cut-out of one of our dishes, where it rests, and the edge it slides in from. */
type Piece = { src: string; w: number; h: number; at: string; from: string; turn: number };

const STEPS: { n: string; title: string; body: string; pieces: Piece[]; phone: Piece }[] = [
  {
    n: "01",
    title: "Thoughtful Sourcing",
    body: "We focus on selecting quality ingredients that form the foundation of good food.",
    pieces: [
      { src: "/cut/broccoli-corn-salad-bowl.webp", w: 732, h: 757, at: "-right-[6%] top-[20%] w-[min(34vw,460px)]", from: "translate(45vw, 0)", turn: 8 },
      { src: "/cut/cucumber-and-avocado-salad-bowl.webp", w: 831, h: 813, at: "right-[24%] -top-[10%] w-[min(20vw,270px)]", from: "translate(10vw, -50vh)", turn: -12 },
    ],
    phone: { src: "/cut/broccoli-corn-salad-bowl.webp", w: 732, h: 757, at: "", from: "", turn: 8 },
  },
  {
    n: "02",
    title: "Fresh Preparation",
    body: "Our meals are prepared with attention to freshness, quality and consistency.",
    pieces: [
      { src: "/art/green_topped_toast.webp", w: 2000, h: 1091, at: "-right-[8%] top-[22%] w-[min(44vw,600px)]", from: "translate(50vw, 0)", turn: -6 },
      { src: "/landing/juice-bottle-cut.webp", w: 351, h: 938, at: "right-[30%] -bottom-[6%] w-[min(9vw,130px)]", from: "translate(0, 60vh)", turn: 10 },
    ],
    phone: { src: "/art/green_topped_toast.webp", w: 2000, h: 1091, at: "", from: "", turn: -6 },
  },
  {
    n: "03",
    title: "Balanced Combinations",
    body: "We bring ingredients together to create meals that balance flavour, variety and nutrition.",
    pieces: [
      { src: "/landing/salad-bowl-cut.webp", w: 609, h: 619, at: "-right-[4%] top-[24%] w-[min(32vw,440px)]", from: "translate(45vw, 10vh)", turn: 8 },
      { src: "/cut/italian-pesto-pasta-bowl.webp", w: 769, h: 833, at: "right-[18%] -top-[9%] w-[min(19vw,260px)]", from: "translate(10vw, -50vh)", turn: -10 },
      { src: "/cut/mediterranean-salad-bowl.webp", w: 797, h: 811, at: "right-[32%] -bottom-[12%] w-[min(18vw,240px)]", from: "translate(0, 55vh)", turn: 14 },
    ],
    phone: { src: "/landing/salad-bowl-cut.webp", w: 609, h: 619, at: "", from: "", turn: 8 },
  },
  {
    n: "04",
    title: "Made for You",
    body: "Freshly prepared for you according to your needs and ready to fit into your day, wherever you are.",
    pieces: [
      { src: "/cut/tandoori-grill.webp", w: 1000, h: 691, at: "-right-[9%] top-[22%] w-[min(44vw,600px)]", from: "translate(50vw, 0)", turn: -6 },
      { src: "/art/chocolate_bottle.webp", w: 826, h: 2000, at: "right-[32%] -bottom-[4%] w-[min(8vw,110px)]", from: "translate(0, 60vh)", turn: -12 },
    ],
    phone: { src: "/cut/tandoori-grill.webp", w: 1000, h: 691, at: "", from: "", turn: -6 },
  },
];

function Art({ piece, sizes }: { piece: Piece; sizes: string }) {
  return <Image src={piece.src} alt="" width={piece.w} height={piece.h} sizes={sizes} className="h-auto w-full drop-shadow-2xl" />;
}

/**
 * "How we make it better" as a scroll-told story. On wide screens the scene pins; each step's words take the
 * stage while its ingredients drift in from the edges and leave as the next step arrives.
 */
export function HowWeMakeIt() {
  const story = useStoryMode();
  const { ref, step } = useScene<HTMLElement>(STEPS.length, story);

  const intro = (
    <>
      <p className="text-sm font-semibold text-butter">How we make it better</p>
      <h2 id="how-h" className="mt-3 max-w-2xl font-display text-4xl leading-[1.04] sm:text-5xl">
        From Thoughtful Ingredients to <em className="italic text-butter">Feel-Good Meals.</em>
      </h2>
      <p className="mt-4 max-w-md text-cream/75">Every Seiketsu meal begins with an idea: eating well should be simple, enjoyable and accessible.</p>
    </>
  );

  if (!story) {
    return (
      <section id="how" className="relative scroll-mt-20 overflow-hidden bg-olive-ink text-cream" aria-labelledby="how-h">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          {intro}
          <ol className="mt-12 space-y-14">
            {STEPS.map((s) => (
              <li key={s.n} className="relative min-h-40">
                <div aria-hidden className={`pointer-events-none absolute top-1/2 ${s.phone.w > s.phone.h * 1.3 ? "-right-24 w-64 sm:-right-10 sm:w-80" : "-right-14 w-44 sm:-right-6 sm:w-60"}`} style={{ transform: `translateY(-50%) rotate(${s.phone.turn}deg)` }}>
                  <Art piece={s.phone} sizes="240px" />
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
    <section ref={ref} id="how" className="relative scroll-mt-20 bg-olive-ink text-cream" style={{ height: `${STEPS.length * 90 + 40}svh` }} aria-labelledby="how-h">
      <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden">
        {/* The ingredients: no frames; they come in from the edges and rest half off the screen. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {STEPS.map((s, i) =>
            s.pieces.map((piece, j) => {
              const on = i === step;
              const past = i < step;
              return (
                <div
                  key={`${s.n}-${j}`}
                  className={`absolute ${piece.at} transition-[transform,opacity] duration-[900ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]`}
                  style={{
                    transform: on ? `translate(0, 0) rotate(${piece.turn}deg)` : past ? `translate(0, -40vh) rotate(${piece.turn - 20}deg)` : `${piece.from} rotate(${piece.turn + 25}deg)`,
                    opacity: on ? 1 : 0,
                    transitionDelay: on ? `${j * 90}ms` : "0ms",
                  }}
                >
                  <Art piece={piece} sizes="(min-width: 1024px) 640px, 46vw" />
                </div>
              );
            }),
          )}
        </div>

        <div className="relative mx-auto flex h-full max-w-6xl flex-col px-6 pb-10 pt-12">
          <div>{intro}</div>

          {/* The words: one step at a time, large. */}
          <div className="relative my-auto grid">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                aria-hidden={i !== step}
                className={`col-start-1 row-start-1 max-w-md transition-[transform,opacity] duration-700 ${i === step ? "translate-y-0 opacity-100" : i < step ? "-translate-y-8 opacity-0" : "translate-y-8 opacity-0"}`}
              >
                <p className="font-display text-[7rem] leading-none text-cream/15">{s.n}</p>
                <h3 className="-mt-10 font-display text-5xl leading-[1.05] lg:text-6xl">{s.title}</h3>
                <p className="mt-4 text-xl leading-relaxed text-cream/80">{s.body}</p>
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
