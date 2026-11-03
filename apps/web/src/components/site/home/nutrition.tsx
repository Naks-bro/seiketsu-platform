import Link from "next/link";
import { formatINR } from "@/lib/format";

export type Spotlight = { slug: string; name: string; option: string | null; pricePaise: number; kcal: number; proteinG: number; carbsG: number; fatG: number; fibreG: number };

/** Real numbers from the menu: the dishes with the most protein, and everything else on the label. */
export function NutritionSpotlight({ dishes }: { dishes: Spotlight[] }) {
  if (!dishes.length) return null;
  const max = (k: "carbsG" | "fatG" | "fibreG") => Math.max(...dishes.map((d) => d[k]), 1);
  const scale = { carbsG: max("carbsG"), fatG: max("fatG"), fibreG: max("fibreG") };
  return (
    <section className="bg-ink py-16 text-cream" aria-labelledby="nutri-h">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 id="nutri-h" data-reveal className="max-w-2xl font-display text-5xl leading-[1.02] sm:text-6xl">
            The kind of food you feel <em className="italic text-butter">good</em> about.
          </h2>
          <Link href="/menu" className="font-semibold text-butter hover:underline">Nutrition for every dish →</Link>
        </div>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-[1.75rem] bg-cream/10 sm:grid-cols-2 lg:grid-cols-4">
          {dishes.map((d, i) => (
            <li key={d.slug + d.option} data-reveal style={{ "--d": `${i * 90}ms` } as React.CSSProperties} className="flex flex-col bg-ink p-7">
              <p className="tabular font-display text-7xl leading-none text-butter">
                {d.proteinG}
                <span className="ml-1 font-sans text-base font-semibold text-cream/60">g protein</span>
              </p>
              <Link href={`/menu#${d.slug}`} className="mt-6 font-display text-2xl leading-tight hover:text-butter">{d.name}</Link>
              <p className="mt-1 text-sm text-cream/60">
                {[d.option, `${d.kcal} kcal`, formatINR(d.pricePaise)].filter(Boolean).join(" · ")}
              </p>
              <dl className="mt-6 space-y-2.5 text-xs">
                {(
                  [
                    ["Carbs", d.carbsG, scale.carbsG, "bg-orange"],
                    ["Fat", d.fatG, scale.fatG, "bg-pink"],
                    ["Fibre", d.fibreG, scale.fibreG, "bg-olive"],
                  ] as const
                ).map(([k, v, m, tone]) => (
                  <div key={k} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3">
                    <dt className="text-cream/60">{k}</dt>
                    <div className="h-1.5 overflow-hidden rounded-full bg-cream/10" aria-hidden>
                      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.round((v / m) * 100)}%` }} />
                    </div>
                    <dd className="tabular text-right font-semibold">{v}g</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-cream/50">Approximate values supplied by Seiketsu.</p>
      </div>
    </section>
  );
}
