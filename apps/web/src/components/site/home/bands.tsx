import { Sparkle } from "./doodles";

const ESSENCE = ["Freshness", "Nutrition", "Flavour", "Integrity", "Experience", "Lifestyle"];

export function Marquee() {
  const row = [...ESSENCE, ...ESSENCE];
  return (
    <div className="overflow-hidden border-y-2 border-ink bg-berry py-4 text-cream" aria-label={`Clean nourishment: ${ESSENCE.join(", ")}`}>
      <div className="animate-marquee flex w-max gap-8" aria-hidden>
        {[...row, ...row].map((w, i) => (
          <span key={i} className="flex items-center gap-8 font-display text-3xl uppercase tracking-wide sm:text-4xl">
            {w}
            <Sparkle className="size-5 text-butter" />
          </span>
        ))}
      </div>
    </div>
  );
}

const LINES = ["This is not diet food.", "This is not wellness as a passing trend.", "This is everyday nourishment, thoughtfully elevated."];

export function Manifesto() {
  return (
    <section className="relative overflow-hidden bg-butter" aria-label="What Seiketsu is">
      <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 md:py-32">
        {LINES.map((l, i) => (
          <p
            key={l}
            data-reveal
            style={{ "--d": `${i * 140}ms` } as React.CSSProperties}
            className={`font-display leading-[1.02] tracking-tight ${
              i === 2 ? "mt-6 text-[clamp(2.4rem,6vw,4.75rem)] text-berry" : "text-[clamp(1.8rem,4.5vw,3.5rem)] text-ink/40 line-through decoration-berry/60 decoration-[3px]"
            }`}
          >
            {i === 2 ? (
              <>
                This is <em className="italic">everyday nourishment</em>, thoughtfully elevated.
              </>
            ) : (
              l
            )}
          </p>
        ))}
        <p data-reveal className="mt-10 max-w-xl text-lg text-ink/75">
          Because eating well should feel less like a compromise and more like a natural part of living better.
        </p>
      </div>
    </section>
  );
}

const PERSONALITY = [
  ["Pure", "Clear, considered, uncomplicated."],
  ["Intelligent", "Guided by nutrition, not trends."],
  ["Fresh", "Vibrant and uplifting."],
  ["Refined", "Thoughtful in every detail."],
  ["Aspirational", "A lifestyle, not a set of rules."],
  ["Confident", "No judgement. Ever."],
];

export function Personality() {
  return (
    <section className="bg-ink py-20 text-cream" aria-labelledby="pers-h">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="pers-h" className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
          Knowledgeable, never clinical. Premium, never <em className="italic text-butter">intimidating.</em>
        </h2>
        <ul className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-cream/10 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONALITY.map(([k, v], i) => (
            <li key={k} data-reveal style={{ "--d": `${i * 70}ms` } as React.CSSProperties} className="bg-ink p-7">
              <p className="font-display text-3xl uppercase tracking-wide text-butter">{k}</p>
              <p className="mt-2 text-cream/70">{v}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
