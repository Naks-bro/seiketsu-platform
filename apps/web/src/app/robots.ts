import type { MetadataRoute } from "next";
import { env } from "@/lib/server/env";

/** Public pages are open to search engines and AI assistants; staff tools and personal links are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/pos", "/kitchen", "/api/", "/checkout", "/account", "/order/", "/bill/", "/invoice/", "/subscription/", "/support/", "/coming-soon"],
      },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
