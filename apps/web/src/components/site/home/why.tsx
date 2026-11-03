import Link from "next/link";
import { Avocado, Bowl, Broccoli, Farm, Leaf, Scooter } from "./doodles";

const REASONS = [
  { title: "Hydroponically Grown Produce", body: "Vegetables grown through controlled hydroponic farming, bringing the freshness of modern agriculture closer to your plate.", Art: Farm },
  { title: "Thoughtful Ingredients", body: "A focus on selecting quality ingredients and bringing them together with care.", Art: Leaf },
  { title: "Freshly Prepared", body: "Meals prepared to order, with attention to freshness, flavour and consistency.", Art: Broccoli },
  { title: "Nutrition Meets Flavour", body: "Wholesome food that makes eating better enjoyable, never restrictive.", Art: Avocado },
  { title: "Everyday Convenience", body: "Fresh food choices that fit into your routine, wherever your day takes you.", Art: Scooter },
  { title: "Variety for Every Craving", body: "From vibrant salads to satisfying wraps and refreshing smoothies, there’s something for every appetite.", Art: Bowl },
];

export function WhySeiketsu() {
  return (
    <section id="why" className="scroll-mt-20 bg-paper" aria-labelledby="why-h">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[0.8fr_1.2fr] md:gap-14">
        <div className="space-y-5 md:sticky md:top-24 md:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive-ink">Why Seiketsu</p>
          <h2 id="why-h" data-reveal className="font-display text-4xl leading-[1.04] text-ink sm:text-5xl">
            Why Good Food Starts at the <em className="italic text-berry">Source.</em>
          </h2>
          <p data-reveal className="max-w-sm text-ink/70">
            We believe better food begins with better ingredients. That’s why our approach goes beyond the plate.
          </p>
          <Link href="/#how" className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream transition hover:bg-berry">
            Explore the Seiketsu experience →
          </Link>
        </div>
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {REASONS.map(({ title, body, Art }, i) => (
            <li key={title} data-reveal style={{ "--d": `${(i % 2) * 80}ms` } as React.CSSProperties} className="flex gap-4 border-t border-ink/15 py-5">
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
    </section>
  );
}
