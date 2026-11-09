import Link from "next/link";
import { costOf, formatQty, stockLevel, unitCostLabel } from "@seiketsu/core/inventory";
import { can, requireStaff } from "@/lib/server/auth";
import { listIngredients, listSuppliers } from "@/lib/server/inventory";
import { formatINR } from "@/lib/format";
import { PageHeader, panel } from "@/components/admin/ui";
import { IngredientForm } from "./ingredient-form";
import { LevelPill } from "./level-pill";
import { MovementForm } from "./movement-form";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ ingredient?: string }> }) {
  const staff = await requireStaff();
  const { ingredient } = await searchParams;
  const [rows, suppliers] = await Promise.all([listIngredients(staff.outletId), listSuppliers(staff.outletId)]);
  const active = suppliers.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name }));
  const withLevel = rows.map((r) => ({ ...r, level: stockLevel(r.ing.stockMilli, r.ing.reorderMilli) }));
  const attention = withLevel.filter((r) => r.level !== "ok");
  const value = rows.reduce((s, r) => s + (r.ing.costMilliPaise !== null && r.ing.stockMilli > 0 ? costOf(r.ing.stockMilli, r.ing.costMilliPaise) : 0), 0);
  const unpriced = rows.filter((r) => r.ing.costMilliPaise === null).length;

  return (
    <>
      <PageHeader
        title="Inventory"
        lede={`Paid orders take ingredients out of stock automatically, for dishes that have a recipe. Record deliveries, wastage and shelf counts here.${can.manageRecipes(staff) ? "" : " Recipes are set by the owner or a manager."}`}
      />

      {rows.length === 0 && (
        <section className={panel} aria-labelledby="start-h">
          <h2 id="start-h" className="font-display text-xl">Start with your ingredients</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Add what you buy (for example chicken, paneer, quinoa, olive oil) using the form below. Then record what is on the shelf today with &ldquo;Counted the shelf&rdquo;, and add recipes so every sale takes stock out by itself.
          </p>
        </section>
      )}
      {rows.length > 0 && (
        <>
          {attention.length > 0 && (
            <section role="status" className="rounded-2xl border border-orange/50 bg-orange/10 p-4 text-sm">
              <h2 className="font-semibold">Needs attention ({attention.length})</h2>
              <p className="mt-1">
                {attention.map((r, i) => (
                  <span key={r.ing.id}>
                    {i > 0 && ", "}
                    <Link href={`/admin/inventory/${r.ing.id}`} className="font-medium underline">{r.ing.name}</Link> ({r.level === "out" ? "out of stock" : `${formatQty(r.ing.stockMilli, r.ing.unit)} left`})
                  </span>
                ))}
              </p>
            </section>
          )}

          <section id="record" className={panel} aria-labelledby="record-h">
            <h2 id="record-h" className="mb-4 font-display text-xl">Record stock</h2>
            <MovementForm
              defaultIngredient={ingredient}
              suppliers={active}
              ingredients={rows.map((r) => ({ id: r.ing.id, name: r.ing.name, unit: r.ing.unit, onHand: formatQty(r.ing.stockMilli, r.ing.unit) }))}
            />
          </section>

          <section aria-labelledby="stock-h">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <h2 id="stock-h" className="font-display text-2xl">On hand</h2>
              <p className="text-sm text-muted">
                Stock value {formatINR(Math.round(value))}
                {unpriced > 0 && ` · ${unpriced} without a cost yet`}
              </p>
            </div>
            <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-paper text-left text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2">Ingredient</th>
                    <th scope="col" className="px-3 py-2 text-right">On hand</th>
                    <th scope="col" className="px-3 py-2 text-right">Warn at</th>
                    <th scope="col" className="px-3 py-2">Status</th>
                    <th scope="col" className="px-3 py-2 text-right">Avg cost</th>
                    <th scope="col" className="px-3 py-2 text-right">Value</th>
                    <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {withLevel.map(({ ing, supplier, level }) => (
                    <tr key={ing.id}>
                      <th scope="row" className="px-3 py-2 text-left font-medium">
                        <Link href={`/admin/inventory/${ing.id}`} className="hover:text-berry hover:underline">{ing.name}</Link>
                        {supplier && <span className="block text-xs font-normal text-muted">{supplier}</span>}
                      </th>
                      <td className="tabular px-3 py-2 text-right">{formatQty(ing.stockMilli, ing.unit)}</td>
                      <td className="tabular px-3 py-2 text-right text-muted">{ing.reorderMilli !== null ? formatQty(ing.reorderMilli, ing.unit) : "–"}</td>
                      <td className="px-3 py-2"><LevelPill level={level} /></td>
                      <td className="tabular px-3 py-2 text-right">{ing.costMilliPaise !== null ? unitCostLabel(ing.costMilliPaise, ing.unit, formatINR) : <span className="text-muted">–</span>}</td>
                      <td className="tabular px-3 py-2 text-right">{ing.costMilliPaise !== null && ing.stockMilli > 0 ? formatINR(Math.round(costOf(ing.stockMilli, ing.costMilliPaise))) : "–"}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/admin/inventory?ingredient=${ing.id}#record`} className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs hover:border-berry">
                          Record<span className="sr-only"> stock for {ing.name}</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">Stock can dip below zero when sales come in before a delivery is entered. A shelf count puts it right.</p>
          </section>

        </>
      )}

      {/* Always rendered in the same place, so its confirmation survives the page switching out of the empty state. */}
      <section className={panel} aria-labelledby="add-ing-h">
        <h2 id="add-ing-h" className="mb-4 font-display text-xl">Add an ingredient</h2>
        <IngredientForm suppliers={active} />
      </section>
    </>
  );
}
