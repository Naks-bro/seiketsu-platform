const NOT = ["Restrictive diets", "Following food trends"];
const IS = ["Making thoughtful choices", "Enjoying what you eat", "Finding a balance that works for your lifestyle"];

export function SeiketsuPromise() {
  return (
    <section className="bg-butter" aria-labelledby="promise-h">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 md:gap-14">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive-ink">The Seiketsu promise</p>
            <h2 id="promise-h" data-reveal className="font-display text-4xl leading-[1.04] text-ink sm:text-5xl">
              Not Another Healthy Food Place.
              <br />
              <em className="italic text-berry">A Better Food Habit.</em>
            </h2>
            <p data-reveal className="max-w-md text-lg text-ink/75">We don’t believe eating well should feel like a compromise.</p>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-ink/60">It’s not about</p>
              <ul className="mt-1">
                {NOT.map((t) => (
                  <li key={t} data-reveal className="font-display text-2xl text-ink/40 line-through decoration-berry/60 decoration-2 sm:text-3xl">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink/60">It’s about</p>
              <ol className="mt-2 space-y-2">
                {IS.map((t, i) => (
                  <li key={t} data-reveal style={{ "--d": `${i * 120}ms` } as React.CSSProperties} className="flex items-baseline gap-4">
                    <span className="font-display text-lg text-berry tabular">0{i + 1}</span>
                    <span className="font-display text-2xl leading-tight text-ink sm:text-3xl">{t}</span>
                  </li>
                ))}
              </ol>
              <p data-reveal className="mt-4 text-ink/75">At Seiketsu, we make room for all three.</p>
            </div>
          </div>
        </div>
        <p data-reveal className="mt-12 border-t border-ink/15 pt-8 text-center font-display text-3xl text-berry sm:text-5xl">
          Good Food. <em className="italic">Good Choices.</em> Good Living.
        </p>
      </div>
    </section>
  );
}
