const ESSENCE = ["Freshness", "Nutrition", "Flavour", "Integrity", "Experience", "Lifestyle"];

export function Marquee() {
  const row = [...ESSENCE, ...ESSENCE];
  return (
    <div className="overflow-hidden border-t border-cream/15 bg-berry-deep py-5 text-cream" aria-label={`Clean nourishment: ${ESSENCE.join(", ")}`}>
      <div className="animate-marquee flex w-max gap-10" aria-hidden>
        {[...row, ...row].map((w, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-2xl italic sm:text-3xl">
            {w}
            <span className="size-1.5 rounded-full bg-butter" />
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
