const ESSENCE = ["Freshness", "Nutrition", "Flavour", "Integrity", "Experience", "Lifestyle"];

export function Marquee() {
  const row = [...ESSENCE, ...ESSENCE];
  return (
    <div className="overflow-hidden border-t border-cream/15 bg-berry-deep py-5 text-cream">
      <p className="sr-only">Clean nourishment: {ESSENCE.join(", ")}</p>
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
