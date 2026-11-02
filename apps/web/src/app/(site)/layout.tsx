import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { DAY_NAMES, formatHours } from "@seiketsu/core/store-hours";
import { CartProvider } from "@/lib/cart";
import { getStore } from "@/lib/server/catalog";
import { getCustomer } from "@/lib/server/customer-auth";
import { whatsappLink } from "@/lib/format";
import { CartButton, CartDrawer } from "@/components/site/cart-drawer";
import { POLICY_LINKS } from "@/components/site/policy-page";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const [store, customer] = await Promise.all([getStore(), getCustomer()]);
  const wa = whatsappLink(store.whatsapp);
  const notice = store.closureMessage ?? (!store.isOpenNow && store.hours ? "We are closed right now. You can still browse the menu." : null) ?? store.announcement;

  return (
    <CartProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow">Skip to content</a>
      {notice && (
        <div className="bg-butter px-4 py-2 text-center text-sm text-ink" role="status">
          {notice}
        </div>
      )}
      <header className="sticky top-0 z-30 bg-berry text-cream">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="Seiketsu home" className="shrink-0">
            <Image src="/brand/wordmark-berry.png" alt="Seiketsu" width={131} height={26} priority className="h-[22px] w-auto sm:h-[26px]" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium sm:flex" aria-label="Main">
            <Link href="/menu" className="hover:text-butter">Menu</Link>
            <Link href="/#visit" className="hover:text-butter">Visit us</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/account" className="rounded-full px-3 py-2 text-sm font-medium hover:bg-berry-deep">
              {customer ? "Account" : "Sign in"}
            </Link>
            <Link href="/menu" className="rounded-full px-3 py-2 text-sm font-medium hover:bg-berry-deep sm:hidden">
              Menu
            </Link>
            <CartButton />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">{children}</main>
      <CartDrawer />

      <footer className="mt-24 border-t border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3 sm:px-6">
          <div className="space-y-3">
            <p className="font-display text-2xl text-berry">The art of clean eating.</p>
            <p className="text-sm text-muted">Fresh food · Thoughtful ingredients · Feel-good flavours</p>
          </div>
          <div className="space-y-2 text-sm">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive-ink">Find us</h2>
            <address className="not-italic leading-relaxed">
              {store.addressLines.map((l) => (
                <span key={l} className="block">{l}</span>
              ))}
            </address>
            <a href={store.mapUrl} target="_blank" rel="noreferrer" className="inline-block font-medium text-berry underline-offset-4 hover:underline">
              Open in Google Maps
            </a>
          </div>
          <div className="space-y-2 text-sm">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive-ink">Hours</h2>
            {store.hours ? (
              <ul className="tabular space-y-0.5">
                {store.hours.map((h, i) => (
                  <li key={DAY_NAMES[i]} className="flex justify-between gap-4">
                    <span>{DAY_NAMES[i]}</span>
                    <span className="text-muted">{formatHours(h)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Opening hours will be posted soon.</p>
            )}
            <div className="flex gap-4 pt-2">
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="font-medium text-berry hover:underline">
                  WhatsApp {store.phone}
                </a>
              )}
              {store.instagram && (
                <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer" className="font-medium text-berry hover:underline">
                  @{store.instagram}
                </a>
              )}
            </div>
          </div>
        </div>
        <nav aria-label="Policies" className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-5 gap-y-2 px-4 pb-4 text-xs sm:px-6">
          {POLICY_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted hover:text-berry">{l.label}</Link>
          ))}
        </nav>
        <p className="pb-8 text-center text-xs text-muted">© {new Date().getFullYear()} Seiketsu, Versova</p>
      </footer>
    </CartProvider>
  );
}