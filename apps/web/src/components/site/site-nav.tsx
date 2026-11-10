"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useModal } from "./use-modal";
import { LANDING_ONLY } from "@/lib/site-mode";

const LINKS = [
  ...(LANDING_ONLY ? [] : [{ href: "/menu", label: "Menu" }]),
  { href: "/#why", label: "Why Seiketsu" },
  { href: "/#plans", label: "Plans" },
  { href: "/#visit", label: "Visit us" },
];

/** Shrinks the header a little once the page scrolls. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`sticky top-0 z-40 bg-berry text-cream transition-shadow duration-300 ${scrolled ? "shadow-[0_8px_30px_-12px_rgb(42_24_30/0.5)]" : ""}`}>
      {children}
    </header>
  );
}

export function DesktopNav() {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm font-medium lg:flex" aria-label="Main">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={path === l.href ? "page" : undefined}
          className="rounded-full px-3 py-2 transition hover:bg-berry-deep aria-[current=page]:bg-berry-deep"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav({ accountLabel }: { accountLabel: string | null }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useModal(panel, open, () => setOpen(false));
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Open menu" className="grid size-11 place-items-center rounded-full hover:bg-berry-deep">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div aria-hidden className="animate-fade-in absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Site menu" className="animate-drawer-in absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-berry p-6 text-cream outline-none">
            <button type="button" onClick={() => setOpen(false)} className="self-end rounded-full px-3 py-2 text-sm hover:bg-berry-deep">
              Close
            </button>
            <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
              {[...LINKS, ...(accountLabel ? [{ href: "/account", label: accountLabel }] : [])].map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-display text-3xl hover:bg-berry-deep">
                  {l.label}
                </Link>
              ))}
            </nav>
            <p className="mt-auto font-display text-xl italic text-butter">The art of clean eating.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Fades sections in as they scroll into view (skipped for reduced motion via CSS). */
export function RevealOnScroll() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const watch = () => {
      for (const el of document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in):not([data-watched])")) {
        el.dataset.watched = "";
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
        else io.observe(el);
      }
    };
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    document.documentElement.classList.add("js");
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
