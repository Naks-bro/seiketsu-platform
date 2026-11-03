import Link from "next/link";
import { daysLabel } from "@seiketsu/core/subscriptions";
import { formatINR } from "@/lib/format";
import { PlanLink } from "./plans";

export type PlanCard = { slug: string; name: string; tagline: string | null; pricePaise: number; mealsTotal: number; durationDays: number; deliveryDays: string[]; includes: string[] };

export function Subscriptions({ plans }: { plans: PlanCard[] }) {
  return (
    <section id="subscriptions" className="relative scroll-mt-20 overflow-hidden bg-berry text-cream" aria-labelledby="subs-h">
      <div aria-hidden className="pointer-events-none absolute -left-40 top-1/2 size-[36rem] -translate-y-1/2 rounded-full bg-pink/20 blur-[120px]" />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-butter">Seiketsu subscriptions</p>
            <h2 id="subs-h" data-reveal className="mt-3 font-display text-5xl leading-[1.02] sm:text-6xl">
              Make Eating Well a <em className="italic text-butter">Daily Habit.</em>
            </h2>
          </div>
          <div className="space-y-4 text-lg leading-relaxed text-cream/85">
            <p data-reveal>
              Good food shouldn’t be an occasional choice. Make fresh, wholesome eating a part of your everyday routine with Seiketsu
              subscription plans.
            </p>
            <p data-reveal className="text-cream/70">
              Whether it’s your everyday lunch, a healthy meal at work or a regular dose of fresh goodness, find a plan that fits your
              lifestyle.
            </p>
            {plans.length === 0 && (
              <PlanLink interest="subscriptions" className="mt-2 inline-flex items-center gap-2 rounded-full bg-cream px-7 py-4 text-base font-semibold text-berry transition hover:-translate-y-0.5 hover:bg-butter">
                Explore subscription plans →
              </PlanLink>
            )}
          </div>
        </div>

        {plans.length > 0 && (
          <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <li key={p.slug} className="flex flex-col rounded-[1.75rem] bg-cream p-6 text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.5)]">
                <h3 className="font-display text-2xl leading-tight text-berry">{p.name}</h3>
                {p.tagline && <p className="mt-1 text-sm text-ink/70">{p.tagline}</p>}
                <p className="mt-4 font-display text-4xl tabular">{formatINR(p.pricePaise)}</p>
                <p className="text-sm text-muted">{p.mealsTotal} meals · {p.durationDays} days · {daysLabel(p.deliveryDays)}</p>
                {p.includes.length > 0 && (
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {p.includes.slice(0, 4).map((x) => (
                      <li key={x} className="flex items-start gap-2">
                        <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-berry text-[10px] text-cream">✓</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={`/subscribe/${p.slug}`} className="mt-auto pt-6">
                  <span className="block rounded-full bg-berry py-3 text-center font-semibold text-cream transition hover:bg-berry-deep">
                    Subscribe<span className="sr-only"> to {p.name}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {plans.length > 0 && (
          <p className="mt-6 text-sm text-cream/70">
            Looking for something different, like a plan for your office?{" "}
            <PlanLink interest="subscriptions" className="font-semibold text-cream underline">Tell us what you need</PlanLink>.
          </p>
        )}
      </div>
    </section>
  );
}
