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
              Convenient food often puts speed before nutrition. Healthy food can feel restrictive, repetitive, or disconnected from the
              pleasure of eating. Seiketsu was created to bridge that gap.
            </p>
            <p>
              Inspired by the Japanese idea of cleanliness and purity, we believe better nourishment begins with thoughtful choices, from
              the ingredients we use to the way we prepare and serve food.
            </p>
          </div>
          <p data-reveal className="flex items-center gap-3 font-display text-2xl italic text-ink">
            <Sparkle className="size-5 text-orange" /> Clean eating is a choice, not a restriction.
          </p>
        </div>
      </div>
    </section>
  );
}

const PROMISE = [
  ["Nutrition", "Taste", "bg-berry text-cream"],
  ["Freshness", "Convenience", "bg-butter text-ink"],
  ["Wellbeing", "Enjoyment", "bg-olive text-cream"],
  ["Quality", "Everyday access", "bg-pink text-cream"],
];

export function BrandPromise() {
  return (
    <section className="bg-paper" aria-labelledby="promise-h">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 id="promise-h" data-reveal className="max-w-xl font-display text-5xl leading-[1.02] text-ink sm:text-6xl">
            Cleaner choices. <span className="text-berry">Better experiences.</span>
          </h2>
          <p data-reveal className="max-w-sm text-ink/70">
            We bring together the things people usually have to choose between. Eating thoughtfully should never mean giving up the pleasure of food.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISE.map(([a, b, tone], i) => (
            <li
              key={a}
              data-reveal
              style={{ "--d": `${i * 90}ms` } as React.CSSProperties}
              className={`group flex min-h-56 flex-col justify-between rounded-[1.75rem] p-7 transition duration-500 hover:-translate-y-1.5 hover:-rotate-1 ${tone}`}
            >
              <span className="font-display text-6xl leading-none opacity-30 transition group-hover:rotate-90 group-hover:opacity-60" aria-hidden>×</span>
              <p className="font-display text-3xl leading-tight">
                {a}
                <span className="sr-only"> and </span>
                <span className="block opacity-75" aria-hidden>× {b}</span>
                <span className="sr-only">{b}</span>
              </p>
            </li>
          ))}
        </ul>
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
    <section className="relative overflow-hidden bg-cream" aria-labelledby="journey-h">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-olive-ink">Part of Arkoun’s food journey</p>
        <h2 id="journey-h" data-reveal className="mx-auto mt-3 max-w-3xl text-center font-display text-5xl leading-[1.02] text-ink sm:text-6xl">
          From how food is grown to how it’s <em className="italic text-berry">enjoyed.</em>
        </h2>
        <ol className="relative mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
          <svg aria-hidden className="absolute left-[16%] right-[16%] top-16 hidden h-8 w-[68%] md:block" viewBox="0 0 600 30" preserveAspectRatio="none">
            <path d="M0 15 C 100 -5, 200 35, 300 15 S 500 -5, 600 15" fill="none" stroke="#a51c47" strokeWidth="2.5" strokeDasharray="2 10" strokeLinecap="round" />
          </svg>
          {JOURNEY.map(({ n, verb, name, body, Art }, i) => (
            <li key={n} data-reveal style={{ "--d": `${i * 150}ms` } as React.CSSProperties} className="relative text-center">
              <div className="mx-auto grid size-32 place-items-center rounded-full border-2 border-ink bg-white shadow-[6px_6px_0_var(--color-ink)]">
                <Art className="w-24" />
              </div>
              <p className="mt-6 text-xs font-bold tracking-[0.2em] text-berry">{n} · {verb.toUpperCase()}</p>
              <h3 className="mt-1 font-display text-3xl text-ink">{name}</h3>
              <p className="mx-auto mt-2 max-w-xs text-ink/70">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-14 max-w-2xl text-center text-sm text-muted">
          Seiketsu is the consumer-facing part of Arkoun’s vision for food: a philosophy that begins with growing and sourcing better food
          and ends on your plate.
        </p>
      </div>
    </section>
  );
}
