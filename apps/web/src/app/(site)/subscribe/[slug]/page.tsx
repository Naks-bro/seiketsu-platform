import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { addDays, daysLabel, istToday } from "@seiketsu/core/subscriptions";
import { getStore } from "@/lib/server/catalog";
import { getCustomer } from "@/lib/server/customer-auth";
import { getActivePlanBySlug } from "@/lib/server/subscriptions";
import { formatINR } from "@/lib/format";
import { SubscribeForm } from "./subscribe-form";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore();
  const plan = await getActivePlanBySlug(store.outletId, slug);
  if (!plan) return { title: "Subscribe" };
  return {
    title: `${plan.name} subscription`,
    description: plan.tagline ?? plan.description ?? undefined,
    alternates: { canonical: `/subscribe/${plan.slug}` },
  };
}

export default async function SubscribePage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const store = await getStore();
  const plan = await getActivePlanBySlug(store.outletId, slug);
  if (!plan) notFound();
  const me = await getCustomer();
  const today = istToday();

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 sm:px-6 md:grid-cols-[0.9fr_1.1fr] md:pt-14">
      <div className="space-y-5">
        <Link href="/#subscriptions" className="text-sm font-medium text-berry hover:underline">← All plans</Link>
        <p className="text-sm font-semibold text-olive-ink">Seiketsu subscriptions</p>
        <h1 className="font-display text-4xl leading-[1.04] text-berry sm:text-5xl">{plan.name}</h1>
        {plan.tagline && <p className="text-lg text-ink/80">{plan.tagline}</p>}
        <dl className="grid grid-cols-3 gap-3 rounded-2xl bg-paper p-4 text-center">
          <div><dt className="text-xs text-muted">Price</dt><dd className="tabular font-display text-2xl text-ink">{formatINR(plan.pricePaise)}</dd></div>
          <div><dt className="text-xs text-muted">Meals</dt><dd className="tabular font-display text-2xl text-ink">{plan.mealsTotal}</dd></div>
          <div><dt className="text-xs text-muted">Over</dt><dd className="tabular font-display text-2xl text-ink">{plan.durationDays} days</dd></div>
        </dl>
        <p className="text-sm text-muted">Delivered: {daysLabel(plan.deliveryDays)}</p>
        {plan.description && <p className="whitespace-pre-line leading-relaxed text-ink/75">{plan.description}</p>}
        {plan.includes.length > 0 && (
          <ul className="space-y-2">
            {plan.includes.map((x) => (
              <li key={x} className="flex items-start gap-2.5 text-ink/80">
                <span aria-hidden className="mt-1 grid size-4 shrink-0 place-items-center rounded-full bg-berry text-[10px] text-cream">✓</span>
                {x}
              </li>
            ))}
          </ul>
        )}
      </div>
      <SubscribeForm slug={plan.slug} minDate={addDays(today, 1)} maxDate={addDays(today, 60)} defaults={{ name: me?.name ?? "", phone: me?.phone ?? "", email: me?.email ?? "" }} />
    </div>
  );
}
