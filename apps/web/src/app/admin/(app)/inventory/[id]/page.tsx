import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, ingredients, recipeLines, stockMovements } from "@seiketsu/db";
import { formatQty, INPUT_UNITS, stockLevel, unitCostLabel } from "@seiketsu/core/inventory";
import { requireStaff } from "@/lib/server/auth";
import { listSuppliers, recentMovements } from "@/lib/server/inventory";
import { formatINR } from "@/lib/format";
import { btnGhost, PageHeader, panel } from "@/components/admin/ui";
import { archiveIngredientAction } from "../../../inventory-actions";
import { IngredientForm } from "../ingredient-form";
import { LevelPill } from "../level-pill";
import { MovementTable } from "../movement-table";

export const metadata: Metadata = { title: "Ingredient" };

export default async function IngredientPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = await getDb();
  const [ing] = await db.select().from(ingredients).where(and(eq(ingredients.id, id), eq(ingredients.outletId, staff.outletId)));
  if (!ing) notFound();
  const [[moves], [recipes], suppliers, history] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(stockMovements).where(eq(stockMovements.ingredientId, id)),
    db.select({ n: sql<number>`count(*)::int` }).from(recipeLines).where(eq(recipeLines.ingredientId, id)),
    listSuppliers(staff.outletId),
    recentMovements(staff.outletId, { ingredientId: id, limit: 100 }),
  ]);

  // Show the warning level in the bigger unit when it is at least one of them (2 kg rather than 2000 g).
  let reorder: string | undefined;
  let reorderUnit: string | undefined;
  if (ing.reorderMilli !== null) {
    const units = INPUT_UNITS[ing.unit];
    const big = units[0];
    const useBig = units.length > 1 && ing.reorderMilli >= big.factor * 1000;
    const u = useBig ? big : units[units.length - 1];
    reorderUnit = u.label;
    reorder = String(ing.reorderMilli / 1000 / u.factor);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm"><Link href="/admin/inventory" className="text-berry underline">← All stock</Link></p>
      <PageHeader title={ing.name} lede={ing.isActive ? undefined : "Archived: hidden from stock lists and recipe choices."}>
        <Link href={`/admin/inventory?ingredient=${ing.id}#record`} className={btnGhost}>Record stock</Link>
        <form action={archiveIngredientAction}>
          <input type="hidden" name="id" value={ing.id} />
          <input type="hidden" name="active" value={String(!ing.isActive)} />
          <button type="submit" className={btnGhost}>{ing.isActive ? "Archive" : "Restore"}</button>
        </form>
      </PageHeader>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Summary">
        <div className={panel}>
          <p className="text-xs font-semibold text-muted">On hand</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">{formatQty(ing.stockMilli, ing.unit)} <LevelPill level={stockLevel(ing.stockMilli, ing.reorderMilli)} /></p>
        </div>
        <div className={panel}>
          <p className="text-xs font-semibold text-muted">Average cost</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{ing.costMilliPaise !== null ? unitCostLabel(ing.costMilliPaise, ing.unit, formatINR) : "Not known yet"}</p>
          {ing.costMilliPaise === null && <p className="text-xs text-muted">Record a delivery with its bill total.</p>}
        </div>
        <div className={panel}>
          <p className="text-xs font-semibold text-muted">Used in</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{recipes.n} {recipes.n === 1 ? "recipe" : "recipes"}</p>
        </div>
      </section>

      <section className={panel} aria-labelledby="edit-h">
        <h2 id="edit-h" className="mb-4 font-display text-xl">Details</h2>
        <IngredientForm
          suppliers={suppliers.filter((s) => s.isActive || s.id === ing.supplierId).map((s) => ({ id: s.id, name: s.name }))}
          unitLocked={moves.n > 0 || recipes.n > 0}
          initial={{ id: ing.id, name: ing.name, unit: ing.unit, reorder, reorderUnit, supplierId: ing.supplierId }}
        />
      </section>

      <section aria-labelledby="hist-h">
        <h2 id="hist-h" className="mb-2 font-display text-2xl">History</h2>
        <MovementTable rows={history} showIngredient={false} />
      </section>
    </div>
  );
}
