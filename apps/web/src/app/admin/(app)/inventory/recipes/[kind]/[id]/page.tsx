import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { addons, getDb, menuItems, menuItemVariants, recipeLines } from "@seiketsu/db";
import { INPUT_UNITS } from "@seiketsu/core/inventory";
import { can, requireStaff } from "@/lib/server/auth";
import { listIngredients } from "@/lib/server/inventory";
import { formatINR } from "@/lib/format";
import { PageHeader, panel } from "@/components/admin/ui";
import { RecipeEditor } from "../../recipe-editor";

export const metadata: Metadata = { title: "Recipe" };

export default async function RecipePage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const staff = await requireStaff();
  const { kind, id } = await params;
  if (!["size", "extra"].includes(kind) || !z.string().uuid().safeParse(id).success) notFound();
  const db = await getDb();

  let title: string;
  let pricePaise: number;
  if (kind === "size") {
    const [row] = await db
      .select({ v: menuItemVariants, item: menuItems })
      .from(menuItemVariants)
      .innerJoin(menuItems, eq(menuItems.id, menuItemVariants.menuItemId))
      .where(eq(menuItemVariants.id, id));
    if (!row) notFound();
    title = `${row.item.name}${row.v.label ? ` · ${row.v.label}` : ""}`;
    pricePaise = row.v.pricePaise;
  } else {
    const [a] = await db.select().from(addons).where(eq(addons.id, id));
    if (!a) notFound();
    title = `Extra: ${a.name}`;
    pricePaise = a.pricePaise;
  }

  const [ings, lines] = await Promise.all([
    listIngredients(staff.outletId, { includeArchived: true }),
    db.select().from(recipeLines).where(kind === "size" ? eq(recipeLines.variantId, id) : eq(recipeLines.addonId, id)),
  ]);
  const own = new Map(ings.map((i) => [i.ing.id, i.ing]));
  const initial = lines
    .filter((l) => own.has(l.ingredientId))
    .map((l) => {
      const ing = own.get(l.ingredientId)!;
      // Recipes read best in the small unit (g, ml, pcs).
      const units = INPUT_UNITS[ing.unit];
      return { ingredientId: l.ingredientId, qty: String(l.qtyMilli / 1000), qtyUnit: units[units.length - 1].label };
    });

  return (
    <div className="space-y-6">
      <p className="text-sm"><Link href="/admin/inventory/recipes" className="text-berry underline">← All recipes</Link></p>
      <PageHeader title={title} lede={`Sells for ${formatINR(pricePaise)}. Enter what one portion actually uses, from your kitchen's own measurements.`} />
      <section className={panel}>
        <RecipeEditor
          target={kind === "size" ? { variantId: id } : { addonId: id }}
          pricePaise={pricePaise}
          canEdit={can.manageRecipes(staff)}
          initial={initial}
          ingredients={ings
            .filter((i) => i.ing.isActive || lines.some((l) => l.ingredientId === i.ing.id))
            .map((i) => ({ id: i.ing.id, name: i.ing.name, unit: i.ing.unit, cost: i.ing.costMilliPaise }))}
        />
      </section>
    </div>
  );
}
