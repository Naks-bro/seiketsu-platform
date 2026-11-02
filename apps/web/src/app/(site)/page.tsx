import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { formatHours, istDayIndex } from "@seiketsu/core/store-hours";
import { getMenu, getStore } from "@/lib/server/catalog";
import { formatINR, fromPrice, whatsappLink } from "@/lib/format";

export default async function HomePage() {
  await connection();
  const store = await getStore();
  const menu = await getMenu(store.outletId);
  const featured = menu.flatMap((c) => c.items).filter((i) => i.isFeatured || i.isBestseller).slice(0, 6);
  const today = store.hours?.[istDayIndex(new Date())] ?? null;
  const wa = whatsappLink(store.whatsapp, "Hi Seiketsu! I would like to place an order.");

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:pt-16">
        <div className="space-y-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive-ink">Versova · Andheri West · Mumbai</p>
          <h1 className="font-display text-5xl leading-[1.02] text-berry sm:text-6xl lg:text-7xl">
            The art of <em className="font-normal italic">clean</em> eating.
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-muted">
            Fresh food, thoughtful ingredients and feel-good flavours. Salads, wraps, bowls, cold-pressed juices and smoothies,
            made to order in our Versova kitchen.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/menu" className="rounded-full bg-berry px-7 py-3.5 font-semibold text-cream shadow-[var(--shadow-lift)] hover:bg-berry-deep">
              Order now
            </Link>
            <Link href="#visit" className="rounded-full border border-berry/30 px-7 py-3.5 font-semibold text-berry hover:bg-paper">
              Visit us
            </Link>
          </div>
          <p className="text-sm text-muted">
            {store.isOpenNow ? (
              <><span className="mr-2 inline-block size-2 rounded-full bg-veg align-middle" />Open now{today ? ` · ${formatHours(today)}` : ""}</>
            ) : store.hours ? (
              "Closed right now. Browse the menu and order when we open."
            ) : (
              "Online ordering opens soon."
            )}
          </p>
        </div>
        <div className="relative mx-auto aspect-[4/5] w-full max-w-sm md:max-h-[600px] md:max-w-[480px]">
          <div className="absolute -inset-3 -rotate-2 rounded-[2rem] bg-butter" aria-hidden />
          <Image
            src="/art/food_brand_banner.webp"
            alt="A protein salad bowl and a toasted caprese sandwich on green plates, with the words The art of clean eating"
            fill
            priority
            sizes="(min-width: 768px) 480px, 90vw"
            className="rounded-[1.75rem] object-cover object-top shadow-[var(--shadow-lift)]"
          />
        </div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl text-ink sm:text-4xl">On the menu</h2>
            <Link href="/menu" className="text-sm font-semibold text-berry hover:underline">See everything</Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {menu.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/menu#${c.slug}`}
                  className="group flex h-full flex-col justify-between gap-6 rounded-2xl border border-line bg-cream p-5 transition hover:border-berry/40 hover:shadow-[var(--shadow-lift)]"
                >
                  <span className="font-display text-2xl text-berry">{c.name}</span>
                  <span className="text-sm text-muted">
                    {c.items.length} {c.items.length === 1 ? "choice" : "choices"} · from{" "}
                    <span className="tabular">{formatINR(fromPrice(c.items.flatMap((i) => i.variants.map((v) => v.pricePaise))))}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="mb-8 font-display text-3xl sm:text-4xl">Favourites</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((i) => (
              <li key={i.id} className="rounded-2xl border border-line p-5">
                <Link href={`/menu#${i.slug}`} className="space-y-2">
                  <p className="font-display text-xl text-berry">{i.name}</p>
                  {i.description && <p className="line-clamp-2 text-sm text-muted">{i.description}</p>}
                  <p className="tabular text-sm font-semibold">from {formatINR(fromPrice(i.variants.map((v) => v.pricePaise)))}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="visit" className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
        <div className="space-y-5">
          <h2 className="font-display text-3xl sm:text-4xl">Visit us in Versova</h2>
          <address className="not-italic text-lg leading-relaxed">
            {store.addressLines.map((l) => (
              <span key={l} className="block">{l}</span>
            ))}
          </address>
          <div className="flex flex-wrap gap-3">
            <a href={store.mapUrl} target="_blank" rel="noreferrer" className="rounded-full bg-olive px-5 py-2.5 text-sm font-semibold text-cream hover:bg-olive-ink">
              Get directions
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="rounded-full border border-berry/30 px-5 py-2.5 text-sm font-semibold text-berry hover:bg-paper">
                Message us on WhatsApp
              </a>
            )}
          </div>
          <p className="text-sm text-muted">
            Call or WhatsApp <span className="font-medium text-ink">{store.phone}</span>
            {store.instagram && <> · Instagram <span className="font-medium text-ink">@{store.instagram}</span></>}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3" aria-hidden>
          {["red_juice_bottle", "orange_juice_bottle", "chocolate_bottle"].map((b, i) => (
            <div key={b} className={`relative aspect-[3/5] overflow-hidden rounded-2xl bg-white ${i === 1 ? "translate-y-6" : ""}`}>
              <Image src={`/art/${b}.webp`} alt="" fill sizes="(min-width: 768px) 200px, 30vw" className="object-contain p-2" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}