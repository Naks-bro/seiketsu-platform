import type { Metadata } from "next";
import Link from "next/link";
import { asc, isNull } from "drizzle-orm";
import { categories, getDb, menuItems, menuItemVariants } from "@seiketsu/db";
import { foodCostBps, recipeCost, type RecipeLine } from "@seiketsu/core/inventory";
import { can, requireStaff } from "@/lib/server/auth";
import { addonList, allRecipes } from "@/lib/server/inventory";
import { formatINR } from "@/lib/format";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Recipes" };

function summary(lines: RecipeLine[] | undefined, costs: Map<string, number | null>, price: number) {
  if (!lines?.length) return { text: "No recipe yet", muted: true };
  const cost = recipeCost(lines, costs);
  const n = `${lines.length} ${lines.length === 1 ? "ingredient" : "ingredients"}`;
  if (cost === null) return { text: `${n} · cost shows once every ingredient has a delivery price`, muted: false };
  const bps = foodCostBps(cost, price);
  return { text: `${n} · costs ${formatINR(cost)}${bps !== null ? ` · ${Math.round(bps / 100)}% of price` : ""}`, muted: false };
}

export default async function RecipesPage() {
  const staff = await requireStaff();
  const db = await getDb();
  const [cats, items, variants, extras, recipeRows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sort)),
    db.select().from(menuItems).where(isNull(menuItems.deletedAt)).orderBy(asc(menuItems.sort)),
    db.select().from(menuItemVariants).orderBy(asc(menuItemVariants.sort)),
    addonList(),
    allRecipes(staff.outletId),
  ]);
  const costs = new Map<string, number | null>(recipeRows.map((r) => [r.r.ingredientId, r.cost]));
  const byVariant = new Map<string, RecipeLine[]>();
  const byAddon = new Map<string, RecipeLine[]>();
  for (const { r } of recipeRows) {
    const map = r.variantId ? byVariant : byAddon;
    const k = (r.variantId ?? r.addonId)!;
    map.set(k, [...(map.get(k) ?? []), { ingredientId: r.ingredientId, qtyMilli: r.qtyMilli }]);
  }
  const activeVariants = variants.filter((v) => v.isActive);
  const done = activeVariants.filter((v) => byVariant.has(v.id)).length;
  const verb = can.manageRecipes(staff) ? "Set" : "View";

  return (
    <>
      <PageHeader
        title="Recipes"
        lede={`How much of each ingredient one portion uses, per size. Only dishes with a recipe take stock out when sold. ${done} of ${activeVariants.length} sizes have a recipe.`}
      />
      {cats.map((c) => {
        const list = items.filter((i) => i.categoryId === c.id);
        if (!list.length) return null;
        return (
          <section key={c.id} aria-labelledby={`cat-${c.id}`}>
            <h2 id={`cat-${c.id}`} className="mb-2 font-display text-2xl">{c.name}</h2>
            <ul className="divide-y divide-line rounded-xl border border-line bg-white">
              {list.flatMap((item) =>
                activeVariants
                  .filter((v) => v.menuItemId === item.id)
                  .map((v) => {
                    const s = summary(byVariant.get(v.id), costs, v.pricePaise);
                    return (
                      <li key={v.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {item.name}
                            {v.label && <span className="text-muted"> · {v.label}</span>}
                            <span className="tabular ml-2 text-muted">{formatINR(v.pricePaise)}</span>
                          </p>
                          <p className={`text-xs ${s.muted ? "text-muted" : ""}`}>{s.text}</p>
                        </div>
                        <Link href={`/admin/inventory/recipes/size/${v.id}`} className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs hover:border-berry">
                          {verb} recipe<span className="sr-only"> for {item.name}{v.label ? ` ${v.label}` : ""}</span>
                        </Link>
                      </li>
                    );
                  }),
              )}
            </ul>
          </section>
        );
      })}
      <section aria-labelledby="extras-h">
        <h2 id="extras-h" className="mb-2 font-display text-2xl">Extras</h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {extras.map((a) => {
            const s = summary(byAddon.get(a.id), costs, a.pricePaise);
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{a.name}<span className="tabular ml-2 text-muted">{formatINR(a.pricePaise)}</span></p>
                  <p className={`text-xs ${s.muted ? "text-muted" : ""}`}>{s.text}</p>
                </div>
                <Link href={`/admin/inventory/recipes/extra/${a.id}`} className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs hover:border-berry">
                  {verb} recipe<span className="sr-only"> for {a.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
