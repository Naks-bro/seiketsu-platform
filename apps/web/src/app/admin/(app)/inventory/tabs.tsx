"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/inventory", label: "Stock" },
  { href: "/admin/inventory/recipes", label: "Recipes" },
  { href: "/admin/inventory/suppliers", label: "Suppliers" },
  { href: "/admin/inventory/history", label: "Usage & history" },
];

export function InventoryTabs() {
  const path = usePathname();
  // Ingredient detail pages (/admin/inventory/<id>) belong to the Stock tab.
  const current = TABS.slice(1).find((t) => path.startsWith(t.href))?.href ?? "/admin/inventory";
  return (
    <nav aria-label="Inventory" className="flex flex-wrap gap-2 border-b border-line pb-3">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={current === t.href ? "page" : undefined}
          className={`min-h-10 rounded-full border px-4 py-2 text-sm ${current === t.href ? "border-berry bg-berry text-cream" : "border-line bg-white hover:border-berry"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
