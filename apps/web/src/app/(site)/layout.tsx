import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { DAY_NAMES, formatHours } from "@seiketsu/core/store-hours";
import { CartProvider } from "@/lib/cart";
import { getStore } from "@/lib/server/catalog";
import { activeOutlets, shortName } from "@/lib/server/outlets";
import { getCustomer } from "@/lib/server/customer-auth";
import { whatsappLink } from "@/lib/format";
import { CartButton, CartDrawer, MobileCartBar } from "@/components/site/cart-drawer";
import { LocationPill, LocationSheet } from "@/components/site/location-picker";
import { DesktopNav, HeaderShell, MobileNav, RevealOnScroll } from "@/components/site/site-nav";
import { Toaster } from "@/components/site/toast";
import { POLICY_LINKS } from "@/components/site/policy-page";
import { env } from "@/lib/server/env";
import { ldJson, restaurantJsonLd } from "@/lib/seo";
import { LANDING_ONLY } from "@/lib/site-mode";


export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const [store, customer, outletList] = await Promise.all([getStore(), getCustomer(), activeOutlets()]);
  const PICKUP_FROM = shortName(store.name);
  const here = outletList.find((o) => o.id === store.outletId)?.slug ?? null;
  const wa = whatsappLink(store.whatsapp);
  const notice = store.closureMessage ?? (!store.isOpenNow && store.hours ? "We're closed right now. Browse the menu and order when we open." : null) ?? store.announcement;
  const accountLabel = customer ? "Account" : "Sign in";

  return (
    <CartProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow">Skip to content</a>
      {notice && (
        <div className="bg-butter px-4 py-2 text-center text-sm text-ink" role="status">
          {notice}
        </div>
      )}
      <HeaderShell>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
          <Link href="/" aria-label="Seiketsu home" className="shrink-0">
            <Image src="/brand/wordmark-berry.png" alt="Seiketsu" width={131} height={26} priority className="h-[22px] w-auto sm:h-[26px]" />
          </Link>
          <DesktopNav />
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {!LANDING_ONLY && <LocationPill pickupFrom={PICKUP_FROM} />}
            {!LANDING_ONLY && <Link href="/account" className="hidden rounded-full px-3 py-2 text-sm font-medium hover:bg-berry-deep lg:block">
              {accountLabel}
            </Link>}
            {!LANDING_ONLY && <CartButton />}
            <MobileNav accountLabel={LANDING_ONLY ? null : accountLabel} />
          </div>
        </div>
      </HeaderShell>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(restaurantJsonLd(store, env.siteUrl)) }} />
      <main id="main" tabIndex={-1} className="overflow-x-clip outline-none">{children}</main>
      {!LANDING_ONLY && <CartDrawer
        pickupFrom={PICKUP_FROM}
        pricing={{
          deliveryFeePaise: store.pricing.deliveryFeePaise,
          freeDeliveryAbovePaise: store.pricing.freeDeliveryAbovePaise,
          minOrderPaise: store.pricing.minOrderPaise,
          deliveryEnabled: store.deliveryEnabled,
        }}
      />}
      {!LANDING_ONLY && <LocationSheet pincodes={store.deliveryPincodes} deliveryEnabled={store.deliveryEnabled} pickupEnabled={store.pickupEnabled} pickupFrom={PICKUP_FROM} outlets={outletList.map((o) => ({ slug: o.slug, area: o.area, address: o.addressLines.join(", "), pickupEnabled: o.pickupEnabled, deliveryEnabled: o.deliveryEnabled, pincodes: o.pincodes }))} current={here} />}
      <Toaster />
      {!LANDING_ONLY && <MobileCartBar />}
      <RevealOnScroll />

      <footer className="mt-24 bg-ink text-cream">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-10 pt-16 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Image src="/brand/wordmark-cream.png" alt="Seiketsu" width={126} height={20} className="h-7 w-auto" />
            <p className="font-display text-3xl leading-tight text-butter">The art of clean eating.</p>
            <p className="max-w-xs text-sm text-cream/70">Good food, thoughtful ingredients, feel-good living.</p>
          </div>
          <nav aria-label="Explore" className="space-y-2 text-sm">
            <h2 className="text-xs font-semibold text-cream/50">Explore</h2>
            {!LANDING_ONLY && <Link href="/menu" className="block hover:text-butter">Menu</Link>}
            <Link href="/#why" className="block hover:text-butter">Why Seiketsu</Link>
            <Link href="/#plans" className="block hover:text-butter">Plans &amp; enquiries</Link>
            <Link href="/delivery" className="block hover:text-butter">Delivery &amp; pickup</Link>
            {!LANDING_ONLY && <Link href="/support" className="block hover:text-butter">Help &amp; support</Link>}
            {!LANDING_ONLY && <Link href="/account" className="block hover:text-butter">{accountLabel}</Link>}
          </nav>
          <div className="space-y-2 text-sm">
            <h2 className="text-xs font-semibold text-cream/50">Find us</h2>
            <address className="not-italic leading-relaxed text-cream/85">
              {store.addressLines.map((l) => (
                <span key={l} className="block">{l}</span>
              ))}
            </address>
            <a href={store.mapUrl} target="_blank" rel="noreferrer" className="inline-block font-medium text-butter underline-offset-4 hover:underline">
              Open in Google Maps
            </a>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="hover:text-butter">WhatsApp</a>}
              {store.instagram && <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer" className="hover:text-butter">Instagram</a>}
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <h2 className="text-xs font-semibold text-cream/50">Hours</h2>
            {store.hours ? (
              <ul className="tabular space-y-0.5">
                {store.hours.map((h, i) => (
                  <li key={DAY_NAMES[i]} className="flex justify-between gap-4">
                    <span>{DAY_NAMES[i]}</span>
                    <span className="text-cream/70">{formatHours(h)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-cream/70">Opening hours will be posted soon.</p>
            )}
          </div>
        </div>
        <div className="border-t border-cream/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-cream/60 sm:px-6">
            <p>© {new Date().getFullYear()} Seiketsu</p>
            <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2">
              {POLICY_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="hover:text-cream">{l.label}</Link>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    </CartProvider>
  );
}
