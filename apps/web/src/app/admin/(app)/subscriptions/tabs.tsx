import Link from "next/link";

const TABS = [
  { key: "today", href: "/admin/subscriptions", label: "Today" },
  { key: "subscribers", href: "/admin/subscriptions/subscribers", label: "Subscribers" },
  { key: "plans", href: "/admin/subscriptions/plans", label: "Plans" },
] as const;

export function SubTabs({ current }: { current: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="Subscriptions" className="flex gap-1 rounded-full border border-line bg-white p-1 text-sm font-medium">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} aria-current={t.key === current ? "page" : undefined} className={`rounded-full px-4 py-1.5 ${t.key === current ? "bg-berry text-cream" : "hover:bg-paper"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export const STATUS_TONE: Record<string, string> = {
  pending: "bg-orange/20 text-[#8a4a0c]",
  active: "bg-veg/10 text-veg",
  paused: "bg-butter text-ink",
  completed: "bg-paper text-muted",
  cancelled: "bg-nonveg/10 text-nonveg",
};
