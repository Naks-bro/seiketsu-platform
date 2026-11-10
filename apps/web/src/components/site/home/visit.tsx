import Image from "next/image";
import type { StoreDTO } from "@/lib/types";
import { DAY_NAMES, formatHours } from "@seiketsu/core/store-hours";
import { whatsappLink } from "@/lib/format";
import { Leaf, Tomato } from "./doodles";

export function Visit({ store }: { store: StoreDTO }) {
  const wa = whatsappLink(store.whatsapp, "Hi Seiketsu! I would like to place an order.");
  return (
    <section id="visit" className="scroll-mt-20 bg-cream" aria-labelledby="visit-h">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 md:grid-cols-2">
        <div className="space-y-6">
          <p className="font-display text-xl italic text-olive-ink">Real food that feels like a warm hug.</p>
          <h2 id="visit-h" data-reveal className="font-display text-5xl leading-none text-ink sm:text-6xl">
            Come <em className="italic text-berry">visit us.</em>
          </h2>
          <address className="not-italic text-lg leading-relaxed text-ink/80">
            {store.addressLines.map((l) => (
              <span key={l} className="block">{l}</span>
            ))}
          </address>
          {store.hours && (
            <ul className="tabular max-w-xs text-sm">
              {store.hours.map((h, i) => (
                <li key={DAY_NAMES[i]} className="flex justify-between gap-3 border-b border-dashed border-line py-1">
                  <span className="font-medium">{DAY_NAMES[i]}</span>
                  <span className="text-muted">{formatHours(h)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <a href={store.mapUrl} target="_blank" rel="noreferrer" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream hover:bg-berry">
              Get directions
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="rounded-full border-2 border-ink/15 px-6 py-3 text-sm font-semibold hover:border-ink">
                WhatsApp {store.phone}
              </a>
            )}
          </div>
        </div>
        <div data-reveal="right" className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)]">
            <Image src="/landing/cafe-counter.webp" alt="The Seiketsu counter, with our menu standee beside it" fill sizes="(min-width: 768px) 540px, 92vw" className="object-cover" />
          </div>
          <Tomato className="absolute -left-6 -top-6 w-16" />
          <Leaf className="absolute -bottom-6 right-8 w-16 rotate-12" />
        </div>
      </div>
    </section>
  );
}

/** Shared by the owner; Instagram does not allow downloading, so we link to it. */
const REEL_URL = "https://www.instagram.com/sei_ketsu/reel/De9VjlEo1Ts/";

export function FollowTheFresh({ instagram }: { instagram: string | null }) {
  const tiles = [
    { src: "/landing/poster-bottles-salads.webp", alt: "Seiketsu poster of fresh-pressed juices and salads" },
    { src: "/landing/cafe-standee.webp", alt: "The Seiketsu counter and menu standee" },
    { src: "/menu/green-machine.webp", alt: "Green Machine, a Seiketsu fresh-pressed juice" },
    { src: "/landing/cafe-menu-card.webp", alt: "The Seiketsu menu card: the art of clean eating" },
  ];
  return (
    <section className="-mb-24 bg-paper" aria-labelledby="follow-h">
      <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
        <h2 id="follow-h" data-reveal className="font-display text-5xl uppercase leading-none text-berry sm:text-7xl">Follow the fresh</h2>
        {instagram && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href={REEL_URL}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-3 rounded-full bg-berry py-2 pl-2 pr-6 font-semibold text-cream shadow-[var(--shadow-float)] transition hover:-translate-y-0.5 hover:bg-berry-deep"
            >
              <span className="grid size-10 place-items-center rounded-full bg-cream text-berry transition group-hover:scale-110" aria-hidden>
                <svg viewBox="0 0 24 24" className="ml-0.5 size-4" fill="currentColor"><path d="M7 4.5v15l13-7.5Z" /></svg>
              </span>
              Watch our reel
            </a>
            <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer" className="rounded-full border-2 border-ink/15 px-6 py-3 font-semibold text-ink hover:border-ink">
              @{instagram} on Instagram
            </a>
          </div>
        )}
        <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t, i) => (
            <li key={t.src} data-reveal style={{ "--d": `${i * 80}ms` } as React.CSSProperties} className="relative aspect-square overflow-hidden rounded-2xl bg-white">
              <Image src={t.src} alt={t.alt} fill sizes="(min-width: 768px) 270px, 45vw" className="object-cover" />
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">Tag {instagram ? `@${instagram}` : "us"} to be featured.</p>
      </div>
    </section>
  );
}
