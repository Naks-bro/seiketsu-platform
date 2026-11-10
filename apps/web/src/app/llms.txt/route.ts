import { getMenu, getStore } from "@/lib/server/catalog";
import { listPlans } from "@/lib/server/subscriptions";
import { env } from "@/lib/server/env";
import { llmsText } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** A plain-text summary of the fresh house, its hours and its menu, for AI assistants (llmstxt.org). */
export async function GET() {
  const store = await getStore();
  const [menu, plans] = await Promise.all([getMenu(store.outletId), listPlans(store.outletId, true)]);
  return new Response(llmsText(store, menu, env.siteUrl, plans), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=3600" },
  });
}
