import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { isPincode } from "@seiketsu/core/delivery-area";
import { getStore } from "@/lib/server/catalog";
import { Scooter } from "@/components/site/home/doodles";
import { AreaForm } from "./area-form";

export const metadata: Metadata = { title: "Coming to your area soon", robots: { index: false } };

export default async function ComingSoonPage({ searchParams }: { searchParams: Promise<{ pin?: string }> }) {
  await connection();
  const [{ pin: raw }, store] = await Promise.all([searchParams, getStore()]);
  const pin = raw && isPincode(raw) ? raw : "";

  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-butter/70 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 md:grid-cols-[1fr_1.1fr] md:py-20">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive-ink">Not in your area yet</p>
          <h1 className="font-display text-5xl leading-[1.02] text-berry sm:text-6xl">
            We’re sorry, we don’t deliver {pin ? <>to <span className="tabular whitespace-nowrap">{pin}</span></> : "there"} <em className="font-normal">yet.</em>
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-muted">
            Our kitchen cooks everything fresh, so we keep deliveries close. We’re growing, and the neighbourhoods that ask
            first are the ones we reach first. Leave your details and we’ll get back to you soon.
          </p>
          <Scooter className="w-full max-w-xs" />
          <div className="rounded-2xl border border-line bg-paper p-5">
            <p className="font-semibold">Close to our kitchen?</p>
            <p className="mt-1 text-sm text-muted">
              Order for pickup from {store.addressLines[0]}. We’ll message you when it’s ready.
            </p>
            <Link href="/menu" className="mt-3 inline-block text-sm font-semibold text-berry hover:underline">
              Order for pickup →
            </Link>
          </div>
        </div>
        <AreaForm pin={pin} />
      </div>
    </div>
  );
}
