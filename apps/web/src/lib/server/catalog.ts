import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  addonGroups,
  addons,
  categories,
  getDb,
  menuItemAddonGroups,
  menuItems,
  menuItemVariants,
  outletMenuItems,
  outlets,
  storeSettings,
} from "@seiketsu/db";
import { isOpenAt } from "@seiketsu/core/store-hours";
import type { CategoryDTO, MenuItemDTO, StoreDTO } from "../types";
import { env } from "./env";

export async function getStore(): Promise<StoreDTO> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(outlets)
    .innerJoin(storeSettings, eq(storeSettings.outletId, outlets.id))
    .where(eq(outlets.slug, env.outletSlug));
  if (!row) throw new Error(`Outlet "${env.outletSlug}" not found. Run npm run db:seed.`);
  const o = row.outlets;
  const s = row.store_settings;
  const mapQuery = encodeURIComponent(["Seiketsu", ...o.addressLines].join(", "));
  return {
    outletId: o.id,
    name: o.name,
    addressLines: o.addressLines,
    phone: o.phone,
    whatsapp: o.whatsapp,
    instagram: o.instagram,
    mapUrl: o.mapUrl ?? `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
    hours: s.hours,
    isOpenNow: !!s.hours && isOpenAt(new Date(), s.hours, s.temporarilyClosed),
    closureMessage: s.temporarilyClosed ? s.closureMessage : null,
    announcement: s.announcement,
    pickupEnabled: s.pickupEnabled,
    deliveryEnabled: s.deliveryEnabled,
    deliveryPincodes: s.deliveryPincodes,
    prepTimeMinutes: s.prepTimeMinutes,
    pricing: {
      tax: { enabled: s.taxEnabled, rateBps: s.taxRateBps, inclusive: s.taxInclusive },
      deliveryFeePaise: s.deliveryFeePaise,
      freeDeliveryAbovePaise: s.freeDeliveryAbovePaise,
      minOrderPaise: s.minOrderPaise,
    },
    paymentsMode: env.paymentsMode,
  };
}

function portion(amount: number | null, unit: string | null) {
  return amount && unit ? `${amount}${unit}` : null;
}

/** Customer-visible menu for one outlet: available, reviewed items only. */
export async function getMenu(outletId: string): Promise<CategoryDTO[]> {
  const db = await getDb();
  const cats = await db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sort));

  const items = await db
    .select({ item: menuItems })
    .from(menuItems)
    .innerJoin(outletMenuItems, eq(outletMenuItems.menuItemId, menuItems.id))
    .where(
      and(
        eq(outletMenuItems.outletId, outletId),
        eq(outletMenuItems.isAvailable, true),
        eq(menuItems.needsReview, false),
        isNull(menuItems.deletedAt),
      ),
    )
    .orderBy(asc(menuItems.sort));
  const itemIds = items.map((r) => r.item.id);
  if (itemIds.length === 0) return [];

  const variants = await db
    .select()
    .from(menuItemVariants)
    .where(and(inArray(menuItemVariants.menuItemId, itemIds), eq(menuItemVariants.isActive, true)))
    .orderBy(asc(menuItemVariants.sort));

  const links = await db.select().from(menuItemAddonGroups).where(inArray(menuItemAddonGroups.menuItemId, itemIds));
  const groupIds = [...new Set(links.map((l) => l.groupId))];
  const groups = groupIds.length ? await db.select().from(addonGroups).where(inArray(addonGroups.id, groupIds)) : [];
  const groupAddons = groupIds.length
    ? await db
        .select()
        .from(addons)
        .where(and(inArray(addons.groupId, groupIds), eq(addons.isAvailable, true)))
        .orderBy(asc(addons.sort))
    : [];

  const groupDTO = new Map(
    groups.map((g) => [
      g.id,
      {
        id: g.id,
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        sort: g.sort,
        addons: groupAddons
          .filter((a) => a.groupId === g.id)
          .map((a) => ({ id: a.id, name: a.name, pricePaise: a.pricePaise, diet: a.diet, icon: a.icon })),
      },
    ]),
  );

  const catSlug = new Map(cats.map((c) => [c.id, c.slug]));
  const dto: MenuItemDTO[] = items.map(({ item }) => ({
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    diet: item.diet,
    imageUrl: item.imageUrl,
    isFeatured: item.isFeatured,
    isBestseller: item.isBestseller,
    categorySlug: catSlug.get(item.categoryId) ?? "",
    variants: variants
      .filter((v) => v.menuItemId === item.id)
      .map((v) => ({
        id: v.id,
        label: v.label,
        portion: portion(v.portionAmount, v.portionUnit),
        pricePaise: v.pricePaise,
        diet: v.diet,
        nutrition:
          v.kcal != null
            ? { kcal: v.kcal, proteinG: v.proteinG ?? 0, carbsG: v.carbsG ?? 0, fatG: v.fatG ?? 0, fibreG: v.fibreG ?? 0 }
            : null,
      })),
    addonGroups: links
      .filter((l) => l.menuItemId === item.id)
      .map((l) => groupDTO.get(l.groupId)!)
      .filter((g) => g && g.addons.length > 0)
      .sort((a, b) => a.sort - b.sort),
  }));

  return cats
    .map((c) => ({ id: c.id, slug: c.slug, name: c.name, items: dto.filter((i) => i.categorySlug === c.slug) }))
    .filter((c) => c.items.length > 0);
}