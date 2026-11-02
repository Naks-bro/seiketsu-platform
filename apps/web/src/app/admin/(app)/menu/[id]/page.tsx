import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { addonGroups, categories, getDb, menuItemAddonGroups, menuItems, menuItemVariants, outletMenuItems } from "@seiketsu/db";
import { can, requireStaff } from "@/lib/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { ItemEditor, type EditorItem } from "./item-editor";

export const metadata: Metadata = { title: "Edit dish" };

export default async function EditDishPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  if (!can.manageMenu(staff)) return <p className="text-muted">Only owners and managers can edit the menu.</p>;
  const { id } = await params;
  const db = await getDb();
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sort));
  let item: EditorItem;

  if (id === "new") {
    item = {
      name: "",
      categoryId: cats[0]?.id ?? "",
      description: "",
      diet: "",
      imageUrl: "",
      offersExtras: false,
      showOnMenu: true,
      reviewNotes: null,
      variants: [{ label: "", portionAmount: "", portionUnit: "g", priceRupees: "", kcal: "", proteinG: "", carbsG: "", fatG: "", fibreG: "", isActive: true }],
    };
  } else {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const [row] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    if (!row || row.deletedAt) notFound();
    const vs = await db.select().from(menuItemVariants).where(eq(menuItemVariants.menuItemId, id)).orderBy(asc(menuItemVariants.sort));
    const [extras] = await db
      .select({ g: menuItemAddonGroups.groupId })
      .from(menuItemAddonGroups)
      .innerJoin(addonGroups, eq(addonGroups.id, menuItemAddonGroups.groupId))
      .where(and(eq(menuItemAddonGroups.menuItemId, id), eq(addonGroups.name, "Extras")));
    const [avail] = await db.select().from(outletMenuItems).where(and(eq(outletMenuItems.menuItemId, id), eq(outletMenuItems.outletId, staff.outletId)));
    const s = (n: number | null) => (n === null ? "" : String(n));
    item = {
      id: row.id,
      name: row.name,
      categoryId: row.categoryId,
      description: row.description ?? "",
      diet: row.diet ?? "",
      imageUrl: row.imageUrl ?? "",
      offersExtras: !!extras,
      showOnMenu: !row.needsReview && (avail?.isAvailable ?? false),
      reviewNotes: row.needsReview ? row.reviewNotes : null,
      variants: vs
        .filter((v) => v.isActive)
        .map((v) => ({
          id: v.id,
          label: v.label ?? "",
          portionAmount: s(v.portionAmount),
          portionUnit: (v.portionUnit as "g" | "ml" | null) ?? "g",
          priceRupees: String(v.pricePaise / 100),
          kcal: s(v.kcal),
          proteinG: s(v.proteinG),
          carbsG: s(v.carbsG),
          fatG: s(v.fatG),
          fibreG: s(v.fibreG),
          isActive: true,
        })),
    };
  }

  return (
    <div>
      <p className="mb-2 text-sm"><Link href="/admin/menu" className="text-berry hover:underline">← Menu</Link></p>
      <PageHeader title={id === "new" ? "Add a dish" : `Edit ${item.name}`} />
      <ItemEditor item={item} categories={cats} />
    </div>
  );
}