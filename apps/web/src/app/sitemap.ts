import type { MetadataRoute } from "next";
import { getStore } from "@/lib/server/catalog";
import { listPlans } from "@/lib/server/subscriptions";
import { env } from "@/lib/server/env";
import { PUBLIC_PAGES } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const store = await getStore();
  const plans = await listPlans(store.outletId, true);
  const now = new Date();
  return [
    ...PUBLIC_PAGES.map(([path]) => ({
      url: `${env.siteUrl}${path === "/" ? "" : path}`,
      lastModified: now,
      changeFrequency: path === "/menu" ? ("daily" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : path === "/menu" ? 0.9 : 0.4,
    })),
    ...plans.map((p) => ({ url: `${env.siteUrl}/subscribe/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
