import { DAY_NAMES, formatHours } from "@seiketsu/core/store-hours";
import type { CategoryDTO, StoreDTO, VariantDTO } from "./types";
import { LEGAL } from "./legal";

/** Structured data and plain-text summaries for search engines and AI assistants, built only from what the database holds. */

export const SITE_DESCRIPTION =
  "Good food, thoughtful ingredients, feel-good living. Discover a fresh selection of salads, wraps, nourishing bowls, fresh-pressed juices and smoothies, crafted to bring together great taste and everyday nutrition.";

const rupees = (paise: number) => (paise / 100).toFixed(2);
const shortRupees = (paise: number) => rupees(paise).replace(/\.00$/, "");

/** "Mumbai 400061" as the last address line gives the city and PIN; the rest is the street. */
export function splitAddress(lines: string[]) {
  const last = lines.at(-1) ?? "";
  const m = /^(.*?)[,\s]*(\d{6})$/.exec(last.trim());
  if (!m) return { streetAddress: lines.join(", ") };
  return { streetAddress: lines.slice(0, -1).join(", "), addressLocality: m[1] || undefined, postalCode: m[2] };
}

/** Days with the same hours are grouped, the way schema.org expects. */
export function openingHours(hours: StoreDTO["hours"]) {
  if (!hours) return undefined;
  const groups = new Map<string, string[]>();
  hours.forEach((h, i) => {
    if (!h) return;
    const key = `${h.open}-${h.close}`;
    groups.set(key, [...(groups.get(key) ?? []), DAY_NAMES[i]]);
  });
  return [...groups].map(([key, days]) => {
    const [opens, closes] = key.split("-");
    return { "@type": "OpeningHoursSpecification", dayOfWeek: days, opens, closes };
  });
}

function nutrition(n: VariantDTO["nutrition"]) {
  if (!n) return undefined;
  return {
    "@type": "NutritionInformation",
    calories: `${n.kcal} calories`,
    proteinContent: `${n.proteinG} g`,
    carbohydrateContent: `${n.carbsG} g`,
    fatContent: `${n.fatG} g`,
    fiberContent: `${n.fibreG} g`,
  };
}

export function restaurantJsonLd(store: StoreDTO, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${siteUrl}/#restaurant`,
    name: store.name,
    description: SITE_DESCRIPTION,
    url: siteUrl,
    image: `${siteUrl}/landing/hero-poster.webp`,
    logo: `${siteUrl}/brand/wordmark-berry.png`,
    telephone: store.phone ?? undefined,
    address: { "@type": "PostalAddress", ...splitAddress(store.addressLines), addressCountry: "IN" },
    hasMap: store.mapUrl,
    openingHoursSpecification: openingHours(store.hours),
    hasMenu: `${siteUrl}/menu`,
    identifier: { "@type": "PropertyValue", propertyID: "FSSAI", value: LEGAL.fssai },
    sameAs: store.instagram ? [`https://www.instagram.com/${store.instagram}/`] : undefined,
    potentialAction: { "@type": "OrderAction", target: `${siteUrl}/menu` },
  };
}

export function menuJsonLd(menu: CategoryDTO[], siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: "Seiketsu menu",
    url: `${siteUrl}/menu`,
    inLanguage: "en-IN",
    hasMenuSection: menu.map((c) => ({
      "@type": "MenuSection",
      name: c.name,
      hasMenuItem: c.items.map((i) => {
        const only = i.variants.length === 1 ? i.variants[0] : null;
        return {
          "@type": "MenuItem",
          name: i.name,
          description: i.description ?? undefined,
          image: i.imageUrl ? new URL(i.imageUrl, siteUrl).href : undefined,
          suitableForDiet: i.diet === "veg" ? "https://schema.org/VegetarianDiet" : undefined,
          nutrition: only ? nutrition(only.nutrition) : undefined,
          offers: i.variants.map((v) => ({
            "@type": "Offer",
            name: v.label ?? undefined,
            price: rupees(v.pricePaise),
            priceCurrency: "INR",
          })),
        };
      }),
    })),
  };
}

export const PUBLIC_PAGES: [string, string][] = [
  ["/", "Home"],
  ["/menu", "Menu"],
  ["/delivery", "Delivery & pickup"],
  ["/contact", "Contact us"],
  ["/support", "Help & support"],
  ["/refunds", "Refunds & cancellations"],
  ["/terms", "Terms & conditions"],
  ["/privacy", "Privacy policy"],
];

type PlanSummary = { slug: string; name: string; pricePaise: number; mealsTotal: number; durationDays: number };
const DIET_WORD = { veg: "veg", egg: "egg", non_veg: "non-veg" } as const;

/** /llms.txt: a short, factual Markdown summary that AI assistants can read and quote. */
export function llmsText(store: StoreDTO, menu: CategoryDTO[], siteUrl: string, plans: PlanSummary[]) {
  const out: string[] = [`# ${store.name}`, "", `> ${SITE_DESCRIPTION}`, "", "## Visit", "", `- Address: ${store.addressLines.join(", ")}`];
  if (store.phone) out.push(`- Phone: ${store.phone}`);
  if (store.instagram) out.push(`- Instagram: https://www.instagram.com/${store.instagram}/`);
  out.push(`- Map: ${store.mapUrl}`);
  out.push(`- ${LEGAL.fssaiLabel} ${LEGAL.fssai}`);
  const ways = [store.pickupEnabled && "pickup", store.deliveryEnabled && "delivery"].filter(Boolean);
  if (ways.length) out.push(`- Order online for ${ways.join(" or ")}: ${siteUrl}/menu`);
  if (store.hours) {
    out.push("", "## Opening hours (India time)", "");
    store.hours.forEach((h, i) => out.push(`- ${DAY_NAMES[i]}: ${formatHours(h)}`));
  }
  out.push("", "## Menu", "", "Prices in Indian rupees. Nutrition is per serving, as listed on the menu.");
  for (const c of menu) {
    out.push("", `### ${c.name}`, "");
    for (const i of c.items) {
      const diet = i.diet ? ` (${DIET_WORD[i.diet]})` : "";
      out.push(`- ${i.name}${diet}${i.description ? `: ${i.description}` : ""}`);
      for (const v of i.variants) {
        const n = v.nutrition ? `, ${v.nutrition.kcal} kcal, ${v.nutrition.proteinG} g protein` : "";
        out.push(`  - ${[v.label, v.portion].filter(Boolean).join(", ") || "Regular"}: ₹${shortRupees(v.pricePaise)}${n}`);
      }
    }
  }
  if (plans.length) {
    out.push("", "## Meal subscriptions", "");
    for (const p of plans) out.push(`- [${p.name}](${siteUrl}/subscribe/${p.slug}): ${p.mealsTotal} meals over ${p.durationDays} days, ₹${shortRupees(p.pricePaise)}`);
  }
  out.push("", "## Pages", "");
  for (const [path, label] of PUBLIC_PAGES) out.push(`- [${label}](${siteUrl}${path})`);
  return out.join("\n") + "\n";
}

/** JSON for a <script type="application/ld+json">, safe against a closing tag inside any text. */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
