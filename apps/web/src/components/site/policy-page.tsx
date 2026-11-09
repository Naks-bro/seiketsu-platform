import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const POLICY_LINKS = [
  { href: "/contact", label: "Contact us" },
  { href: "/terms", label: "Terms & conditions" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/refunds", label: "Refunds & cancellations" },
  { href: "/delivery", label: "Delivery & pickup" },
] as const;

export function PolicyPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
      <p className="text-sm font-semibold text-olive-ink">Policies</p>
      <h1 className="mt-2 font-display text-4xl text-berry sm:text-5xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {LEGAL.lastUpdated}</p>
      <div className="policy mt-8 space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-berry [&_li]:ml-5 [&_li]:list-disc [&_a]:font-medium [&_a]:text-berry [&_a]:underline-offset-4 hover:[&_a]:underline">
        {children}
      </div>
      <nav aria-label="Other policies" className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-6 text-sm">
        {POLICY_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-muted hover:text-berry">{l.label}</Link>
        ))}
      </nav>
    </article>
  );
}