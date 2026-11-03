import { Bowl, Broccoli, Crate, Scooter } from "./doodles";

const STEPS = [
  { n: "01", title: "Thoughtful Sourcing", body: "We focus on selecting quality ingredients that form the foundation of good food.", Art: Crate },
  { n: "02", title: "Fresh Preparation", body: "Our meals are prepared with attention to freshness, quality and consistency.", Art: Broccoli },
  { n: "03", title: "Balanced Combinations", body: "We bring ingredients together to create meals that balance flavour, variety and nutrition.", Art: Bowl },
  { n: "04", title: "Made for You", body: "Freshly prepared for you according to your needs and ready to fit into your day, wherever you are.", Art: Scooter },
];

export function HowWeMakeIt() {
  return (
    <section id="how" className="relative scroll-mt-20 overflow-hidden bg-olive-ink text-cream" aria-labelledby="how-h">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-butter">How we make it better</p>
        <h2 id="how-h" data-reveal className="mt-3 max-w-3xl font-display text-4xl leading-[1.04] sm:text-5xl">
          From Thoughtful Ingredients to <em className="italic text-butter">Feel-Good Meals.</em>
        </h2>
        <p data-reveal className="mt-4 max-w-xl text-cream/75">
          Every Seiketsu meal begins with an idea: eating well should be simple, enjoyable and accessible.
        </p>

        <div data-reveal className="relative mt-12">
          {/* The line that ties the steps together draws itself in as the section appears. */}
          <svg aria-hidden className="absolute left-[12.5%] top-4 hidden h-16 w-[75%] md:block" viewBox="0 0 800 100" preserveAspectRatio="none">
            <path className="draw-path" pathLength={1} d="M0 50 C 80 -10, 190 110, 266 50 S 450 -10, 533 50 S 720 110, 800 50" fill="none" stroke="#fce9ab" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span aria-hidden className="absolute bottom-0 left-[2.75rem] top-0 w-px bg-cream/25 md:hidden" />
          <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
            {STEPS.map(({ n, title, body, Art }) => (
              <li key={n} className="relative grid grid-cols-[5.5rem_1fr] gap-5 md:block md:text-center">
                <div className="relative mx-auto grid size-[5.5rem] place-items-center rounded-full bg-cream shadow-[0_0_0_8px_rgb(255_252_245/0.08)] md:size-28">
                  <Art className="w-14 md:w-20" />
                </div>
                <div>
                  <p className="font-display text-4xl leading-none text-transparent [-webkit-text-stroke:1px_rgb(252_233_171/0.7)] md:mt-5">{n}</p>
                  <h3 className="mt-2 font-display text-2xl">{title}</h3>
                  <p className="mx-auto mt-2 max-w-[16rem] text-sm text-cream/75">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
