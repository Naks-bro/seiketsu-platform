import { PlanLink } from "./plans";

export function Subscriptions() {
  return (
    <section className="relative overflow-hidden bg-berry text-cream" aria-labelledby="subs-h">
      <div aria-hidden className="pointer-events-none absolute -left-40 top-1/2 size-[36rem] -translate-y-1/2 rounded-full bg-pink/20 blur-[120px]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 sm:px-6 md:grid-cols-2 md:gap-14">
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
          <PlanLink interest="subscriptions" className="mt-2 inline-flex items-center gap-2 rounded-full bg-cream px-7 py-4 text-base font-semibold text-berry transition hover:-translate-y-0.5 hover:bg-butter">
            Explore subscription plans →
          </PlanLink>
        </div>
      </div>
    </section>
  );
}
