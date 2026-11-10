import Image from "next/image";
import Link from "next/link";
import { daysLabel } from "@seiketsu/core/subscriptions";
import { formatINR } from "@/lib/format";
import { PlanLink } from "./plans";
import { LANDING_ONLY } from "@/lib/site-mode";

export type PlanCard = { slug: string; name: string; tagline: string | null; pricePaise: number; mealsTotal: number; durationDays: number; deliveryDays: string[]; includes: string[] };

const cta = "block rounded-full py-3.5 text-center font-semibold transition";

function PlanItem({ p }: { p: PlanCard }) {
  const perMeal = p.mealsTotal > 0 ? Math.round(p.pricePaise / p.mealsTotal) : null;
  return (
    <li data-reveal="zoom" className="flex flex-col rounded-[1.75rem] bg-cream p-6 text-ink shadow-[var(--shadow-card)] sm:p-7">
      <h3 className="font-display text-2xl leading-tight text-berry">{p.name}</h3>
      {p.tagline && <p className="mt-1 text-sm text-ink/70">{p.tagline}</p>}

      <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-4xl tabular leading-none">{formatINR(p.pricePaise)}</span>
        {perMeal != null && <span className="text-sm text-muted">works out to <span className="tabular">{formatINR(perMeal)}</span> a meal</span>}
      </p>

      <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-2xl bg-paper text-center text-sm">
        <div className="px-1.5 py-3">
          <dt className="text-xs text-muted">Meals</dt>
          <dd className="tabular mt-0.5 font-semibold">{p.mealsTotal}</dd>
        </div>
        <div className="px-1.5 py-3">
          <dt className="text-xs text-muted">Runs for</dt>
          <dd className="tabular mt-0.5 font-semibold">{p.durationDays} days</dd>
        </div>
        <div className="px-1.5 py-3">
          <dt className="text-xs text-muted">Delivered</dt>
          <dd className="mt-0.5 whitespace-nowrap font-semibold">{daysLabel(p.deliveryDays)}</dd>
        </div>
      </dl>

      {p.includes.length > 0 && (
        <ul className="mt-5 space-y-2 text-sm">
          {p.includes.slice(0, 4).map((x) => (
            <li key={x} className="flex items-start gap-2.5">
              <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-berry text-[10px] text-cream">✓</span>
              {x}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-6">
        {LANDING_ONLY ? (
          <PlanLink interest="subscriptions" label={`Enquire about ${p.name}`} className={`${cta} bg-berry text-cream hover:bg-berry-deep`}>
            Enquire
          </PlanLink>
        ) : (
          <Link href={`/subscribe/${p.slug}`} aria-label={`Subscribe to ${p.name}`} className={`${cta} bg-berry text-cream hover:bg-berry-deep`}>
            Subscribe
          </Link>
        )}
      </div>
    </li>
  );
}

export function Subscriptions({ plans }: { plans: PlanCard[] }) {
  return (
    <section id="subscriptions" className="relative scroll-mt-20 overflow-hidden bg-berry text-cream" aria-labelledby="subs-h">
      <div aria-hidden className="pointer-events-none absolute -left-40 top-1/2 size-[36rem] -translate-y-1/2 rounded-full bg-pink/20 blur-[120px]" />
      {plans.length === 0 && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[44%] lg:block">
          <Image src="/cut/mediterranean-salad-bowl.webp" alt="" width={797} height={811} sizes="440px" className="absolute -right-16 top-1/2 h-auto w-[min(34vw,440px)] -translate-y-1/2 rotate-6 drop-shadow-2xl" />
          <Image src="/landing/juice-bottle-cut.webp" alt="" width={351} height={938} sizes="120px" className="absolute bottom-[-12%] left-[24%] h-auto w-[min(9vw,120px)] -rotate-12 drop-shadow-2xl" />
        </div>
      )}
      <div className={`relative mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:gap-14 ${plans.length ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : ""}`}>
        <div className={plans.length ? "lg:sticky lg:top-28 lg:self-start" : "max-w-2xl"}>
          <p className="text-sm font-semibold text-butter">Seiketsu subscriptions</p>
          <h2 id="subs-h" data-reveal className="mt-3 font-display text-5xl leading-[1.02] sm:text-6xl">
            Make Eating Well a <em className="italic text-butter">Daily Habit.</em>
          </h2>
          <p data-reveal className="mt-6 text-lg leading-relaxed text-cream/85">
            Good food shouldn’t be an occasional choice. Make fresh, wholesome eating a part of your everyday routine with Seiketsu
            subscription plans.
          </p>
          <p data-reveal className="mt-4 leading-relaxed text-cream/70">
            Whether it’s your everyday lunch, a healthy meal at work or a regular dose of fresh goodness, find a plan that fits your
            lifestyle.
          </p>

          {plans.length === 0 ? (
            <PlanLink interest="subscriptions" className="mt-8 inline-flex items-center gap-2 rounded-full bg-cream px-7 py-4 text-base font-semibold text-berry transition hover:-translate-y-0.5 hover:bg-butter">
              Explore subscription plans
            </PlanLink>
          ) : (
            <div className="mt-8 rounded-[1.5rem] border border-cream/20 p-5">
              <p className="text-cream/85">Looking for something different, like a plan for your office?</p>
              <PlanLink interest="subscriptions" className="mt-4 inline-flex rounded-full bg-cream px-6 py-3 text-sm font-semibold text-berry transition hover:bg-butter">
                Tell us what you need
              </PlanLink>
            </div>
          )}
        </div>

        {plans.length > 0 && (
          <ul className={`grid gap-4 lg:self-center ${plans.length > 1 ? "sm:grid-cols-2" : "max-w-md"}`}>
            {plans.map((p) => (
              <PlanItem key={p.slug} p={p} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
