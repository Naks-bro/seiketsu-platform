import type { Metadata } from "next";
import Link from "next/link";
import { btnPrimary, PageHeader } from "@/components/admin/ui";
import { AddonEditor } from "./addon-editor";
import { and, asc, eq, isNull } from "drizzle-orm";
import { addons, categories, getDb, menuItems, menuItemVariants, outletMenuItems } from "@seiketsu/db";
import { can, requirePage } from "@/lib/server/auth";
import { formatINR } from "@/lib/format";
import { DietMark } from "@/components/diet-mark";
import { setAddonAvailabilityAction, setItemAvailabilityAction, setItemFlagAction } from "../../actions";

export const metadata: Metadata = { title: "Menu" };

function Toggle({ action, name, id, value, on, label, disabled }: { action: (f: FormData) => Promise<void>; name: string; id: string; value: string; on: boolean; label: string; disabled?: boolean }) {
  return (
    <form action={action}>
      <input type="hidden" name={name} value={id} />
      <input type="hidden" name="available" value={value} />
      <button
        type="submit"
        disabled={disabled}
        className={`min-w-24 rounded-full px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${on ? "bg-veg/15 text-veg" : "bg-nonveg/10 text-nonveg"}`}
      >
        {label}
      </button>
    </form>
  );
}

export default async function AdminMenu() {
  const staff = await requirePage(can.manageOrders);
  const db = await getDb();
  const cats = await db.select().from(categories).orderBy(asc(categories.sort));
  const items = await db
    .select({ item: menuItems, available: outletMenuItems.isAvailable })
    .from(menuItems)
    .leftJoin(outletMenuItems, and(eq(outletMenuItems.menuItemId, menuItems.id), eq(outletMenuItems.outletId, staff.outletId)))
    .where(isNull(menuItems.deletedAt))
    .orderBy(asc(menuItems.sort));
  const variants = await db.select().from(menuItemVariants).orderBy(asc(menuItemVariants.sort));
  const extras = await db.select().from(addons).orderBy(asc(addons.sort));
  const review = items.filter((i) => i.item.needsReview);
  const editFlags = can.manageMenu(staff);

  return (
    <div className="space-y-8">
      <PageHeader title="Menu" lede="Mark dishes sold out for today with one tap. Owners and managers can edit names, prices, sizes and photos.">
        {editFlags && <Link href="/admin/menu/new" className={btnPrimary}>Add a dish</Link>}
      </PageHeader>

      {review.length > 0 && (
        <section className="rounded-2xl border border-orange/50 bg-orange/10 p-4 text-sm">
          <h2 className="font-semibold">Hidden until corrected ({review.length})</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {review.map(({ item }) => (
              <li key={item.id}>
                {editFlags ? <Link href={`/admin/menu/${item.id}`} className="font-medium text-berry underline">{item.name}</Link> : <span className="font-medium">{item.name}</span>}: {item.reviewNotes}
              </li>
            ))}
          </ul>
        </section>
      )}

      {cats.map((c) => {
        const list = items.filter((i) => i.item.categoryId === c.id);
        if (!list.length) return null;
        return (
          <section key={c.id}>
            <h2 className="mb-2 font-display text-2xl">{c.name}</h2>
            <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full min-w-[640px] text-sm">
                <tbody className="divide-y divide-line">
                  {list.map(({ item, available }) => (
                    <tr key={item.id}>
                      <td className="w-6 px-3 py-2"><DietMark diet={item.diet} /></td>
                      <td className="px-3 py-2">
                        {editFlags ? (
                          <Link href={`/admin/menu/${item.id}`} className="font-medium hover:text-berry hover:underline">{item.name}</Link>
                        ) : (
                          <span className="font-medium">{item.name}</span>
                        )}
                        {item.imageUrl && <span className="ml-2 text-xs text-muted">· photo</span>}
                        {item.needsReview && <span className="ml-2 rounded bg-orange/20 px-1.5 text-xs">needs review</span>}
                        <span className="tabular block text-xs text-muted">
                          {variants.filter((v) => v.menuItemId === item.id).map((v) => `${v.label ?? "Regular"} ${formatINR(v.pricePaise)}`).join(" · ")}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {editFlags && (
                          <div className="flex gap-2">
                            {(["isFeatured", "isBestseller"] as const).map((flag) => (
                              <form key={flag} action={setItemFlagAction}>
                                <input type="hidden" name="itemId" value={item.id} />
                                <input type="hidden" name="flag" value={flag} />
                                <input type="hidden" name="value" value={String(!item[flag])} />
                                <button type="submit" className={`rounded-full border px-2.5 py-1 text-xs ${item[flag] ? "border-berry bg-berry text-cream" : "border-line text-muted hover:border-berry"}`}>
                                  {flag === "isFeatured" ? "Featured" : "Bestseller"}
                                </button>
                              </form>
                            ))}
                            <Link href={`/admin/menu/${item.id}`} className="rounded-full border border-line px-2.5 py-1 text-xs hover:border-berry">Edit</Link>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Toggle
                          action={setItemAvailabilityAction}
                          name="itemId"
                          id={item.id}
                          value={String(!available)}
                          on={!!available}
                          disabled={item.needsReview && !available}
                          label={available ? "Available" : "Sold out"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section>
        <h2 className="mb-2 font-display text-2xl">Extras</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {extras.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2 text-sm">
              {editFlags ? (
                <span className="flex min-w-0 flex-1 items-center gap-2"><DietMark diet={a.diet} size={12} /><AddonEditor id={a.id} name={a.name} price={a.pricePaise} icon={a.icon} /></span>
              ) : (
                <span className="flex items-center gap-2"><DietMark diet={a.diet} size={12} />{a.name} <span className="tabular text-muted">{formatINR(a.pricePaise)}</span></span>
              )}
              <Toggle action={setAddonAvailabilityAction} name="addonId" id={a.id} value={String(!a.isAvailable)} on={a.isAvailable} label={a.isAvailable ? "Available" : "Sold out"} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}