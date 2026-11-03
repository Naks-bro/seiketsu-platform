"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useModal } from "@/components/site/use-modal";

type Item = { href: string; label: string };

const GROUPS: [string, string[]][] = [
  ["Run the day", ["/admin/orders", "/kitchen", "/pos"]],
  ["Menu & stock", ["/admin/menu", "/admin/inventory"]],
  ["Customers", ["/admin/customers", "/admin/subscriptions", "/admin/coupons", "/admin/enquiries", "/admin/delivery-areas", "/admin/area-requests", "/admin/messages"]],
  ["Business", ["/admin/reports", "/admin/staff", "/admin/settings"]],
];

/** Small line icons (24px grid, stroked) per section. */
const ICON: Record<string, string> = {
  "/admin/orders": "M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1ZM6 5h12v16H6zM9 11h6M9 15h4",
  "/kitchen": "M6 3v8a3 3 0 0 0 6 0V3M9 3v18M17 3c-2 2-2 6 0 8v10",
  "/pos": "M4 7h16v12H4zM8 7V5h8v2M8 12h2M14 12h2M8 15h2M14 15h2",
  "/admin/menu": "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6",
  "/admin/inventory": "M3 8l9-5 9 5-9 5zM3 8v8l9 5 9-5V8M12 13v8",
  "/admin/subscriptions": "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M8 14h3M13 14h3M8 17h3",
  "/admin/customers": "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  "/admin/coupons": "M3 8V5h18v3a3 3 0 0 0 0 6v3H3v-3a3 3 0 0 0 0-6ZM10 8v8M14 8l-4 8",
  "/admin/enquiries": "M4 5h16v11H8l-4 4zM8 9h8M8 12h5",
  "/admin/delivery-areas": "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  "/admin/area-requests": "M4 12h11M11 6l6 6-6 6M20 4v16",
  "/admin/messages": "M4 6h16v10H9l-5 4zM8 11h.01M12 11h.01M16 11h.01",
  "/admin/reports": "M4 20V10M10 20V4M16 20v-7M22 20H2",
  "/admin/staff": "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.7",
  "/admin/settings": "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4",
};

function Icon({ href }: { href: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICON[href] ?? "M5 12h14"} />
    </svg>
  );
}

function grouped(items: Item[]) {
  const known = new Set(GROUPS.flatMap(([, hrefs]) => hrefs));
  const out = GROUPS.map(([title, hrefs]) => ({ title, items: hrefs.map((h) => items.find((i) => i.href === h)).filter((i): i is Item => !!i) }));
  const rest = items.filter((i) => !known.has(i.href));
  if (rest.length) out.push({ title: "More", items: rest });
  return out.filter((g) => g.items.length);
}

function Links({ items, onPick }: { items: Item[]; onPick?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="space-y-4">
      {grouped(items).map((g) => (
        <div key={g.title}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{g.title}</p>
          <ul className="mt-1 space-y-0.5">
            {g.items.map((i) => {
              const active = path === i.href || path.startsWith(`${i.href}/`);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={onPick}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                      active ? "bg-berry text-cream shadow-[var(--shadow-card)]" : "text-ink/80 hover:bg-paper hover:text-ink"
                    }`}
                  >
                    <Icon href={i.href} />
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="font-display text-xl text-berry">
      seiketsu <span className="font-sans text-sm text-muted">admin</span>
    </Link>
  );
}

type Props = { items: Item[]; homeHref: string; account: React.ReactNode; signOut: React.ReactNode };

/** A grouped sidebar on wide screens; on phones a top bar whose Menu button slides the same sidebar in. */
export function AdminNav({ items, homeHref, account, signOut }: Props) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useModal(panel, open, () => setOpen(false));
  const path = usePathname();
  const here = items.find((i) => path === i.href || path.startsWith(`${i.href}/`))?.label;

  const footer = (
    <div className="space-y-1 border-t border-line pt-3 text-sm">
      {account}
      {signOut}
    </div>
  );

  return (
    <>
      <aside className="no-print sticky top-0 hidden h-dvh flex-col gap-4 border-r border-line bg-cream px-3 py-4 lg:flex">
        <div className="px-3">
          <Brand href={homeHref} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
          <Links items={items} />
        </div>
        {footer}
      </aside>

      <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-cream px-4 lg:hidden">
        <Brand href={homeHref} />
        {here && <span className="truncate text-sm text-muted">· {here}</span>}
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open} className="ml-auto flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-medium">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          Menu
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 animate-fade-in bg-ink/40" />
          <div ref={panel} role="dialog" aria-modal="true" aria-label="Admin menu" className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-drawer-left flex-col gap-6 bg-cream px-3 py-5 shadow-2xl">
            <div className="flex items-center justify-between px-3">
              <Brand href={homeHref} />
              <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full text-xl hover:bg-paper" aria-label="Close menu">
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Links items={items} onPick={() => setOpen(false)} />
            </div>
            {footer}
          </div>
        </div>
      )}
    </>
  );
}
