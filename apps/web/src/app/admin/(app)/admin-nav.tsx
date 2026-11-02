"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-1 flex max-w-full gap-1 overflow-x-auto text-sm font-medium [scrollbar-width:none]">
      {items.map((i) => {
        const active = path === i.href || path.startsWith(`${i.href}/`);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 ${active ? "bg-berry text-cream" : "hover:bg-paper"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}