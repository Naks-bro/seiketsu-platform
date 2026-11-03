/**
 * Imports the owner-supplied menu and creates the Versova outlet.
 * Safe to re-run: it only inserts what is missing and never overwrites
 * changes made later in the admin.
 */
import { fileURLToPath } from "node:url";
import { eq, inArray } from "drizzle-orm";
import { parseMenu, type Diet, type SourceMenuRow } from "@seiketsu/core/menu-parse";
import { EXTRA_GROUPS, extraPlacement } from "@seiketsu/core/extras";
import rows from "../data/seiketsu_menu.json" with { type: "json" };
import { openDb, type Db } from "./client.ts";
import { runMigrations } from "./migrate.ts";
import * as s from "./schema.ts";

export const VERSOVA = {
  slug: "versova",
  name: "Seiketsu Versova",
  addressLines: [
    "Bungalow 95, JP Road, Aram Nagar Part 2",
    "Machlimar, Versova, Andheri West",
    "Mumbai 400061",
  ],
  phone: "+91 95847 58479",
  whatsapp: "919584758479",
  instagram: "sei_ketsu",
};

const CATEGORY_ORDER = ["Salads", "Wraps", "Meals", "Sandwiches", "Pasta", "Juices", "Smoothies"];
/** Section titles as printed on the menu card. */
const CATEGORY_TITLE: Record<string, string> = { Salads: "Fresh Salads", Meals: "Wholesome Meals", Juices: "Fresh-Pressed Juices" };
/** Categories that offer the Extras add-ons (owner to confirm). */
const EXTRAS_ON = new Set(["Salads", "Wraps", "Meals", "Sandwiches", "Pasta"]);

/**
 * Dishes and extras the source sheet leaves unmarked, marked vegetarian from their listed ingredients
 * (dairy, no meat, fish or egg) at the owner's request on 2026-11-03. Migration 0007 does the same on live data.
 */
const VEG_BY_INGREDIENTS = new Set<string>(["avocado-smoothie", "beetroot-apple-carrot", "broccoli-corn-salad-bowl", "celery-green-apple-carrot", "chocolate-smoothie", "creamy-italian-herb-pasta-bowl", "cucumber-and-avocado-salad-bowl", "cucumber-watermelon-salad-bowl", "exotic-apple-salad-bowl", "exotic-fresh-fruits-bowl", "fresh-zucchini-noodles-salad-bowl", "green-machine", "italian-pesto-pasta-bowl", "mediterranean-salad-bowl", "mix-fruit-smoothie", "pomegranate-juice", "red-sauce-pasta-bowl", "spicy-tofu-protein-salad-bowl", "sprouts-protein-salad-bowl", "sunrise-kick", "watermelon-beetroot-lime", "watermelon-mint-refresher"]);
const VEG_EXTRAS = new Set<string>(["Avocado", "Broccoli", "Cherry Tomatoes", "Chilli Tofu", "Feta Cheese", "Guacamole", "Honey Musterd Dip", "Italian Herb Dressing", "Olives", "Peri Peri Dip", "Pesto Sauce", "Russian Dressing"]);
/** Dishes whose nutrition was estimated (USDA FoodData Central), noted for the kitchen to confirm. */
const ESTIMATED = new Set(["healthy-quinoa-salad-bowl", "pomegranate-juice"]);

function extraDiet(name: string): Diet | null {
  if (/chicken/i.test(name)) return "non_veg";
  if (/paneer/i.test(name) || VEG_EXTRAS.has(name)) return "veg";
  return null;
}

export async function seed(db: Db) {
  const items = parseMenu(rows as SourceMenuRow[]);
  const summary = { outlet: 0, categories: 0, items: 0, variants: 0, addons: 0, hidden: [] as string[] };

  // Outlet + settings
  let [outlet] = await db.select().from(s.outlets).where(eq(s.outlets.slug, VERSOVA.slug));
  if (!outlet) {
    [outlet] = await db.insert(s.outlets).values(VERSOVA).returning();
    await db.insert(s.storeSettings).values({ outletId: outlet.id });
    summary.outlet = 1;
  }

  // Categories
  const catIds = new Map<string, string>();
  for (const [i, name] of CATEGORY_ORDER.entries()) {
    const slug = name.toLowerCase();
    const [row] = await db
      .insert(s.categories)
      .values({ slug, name: CATEGORY_TITLE[name] ?? name, sort: i })
      .onConflictDoNothing({ target: s.categories.slug })
      .returning();
    if (row) summary.categories++;
    const [cat] = row ? [row] : await db.select().from(s.categories).where(eq(s.categories.slug, slug));
    catIds.set(name, cat.id);
  }

  // Extras sit on Subway-style shelves (Proteins, Cheese, ...). Ids stay stable on re-runs.
  const groupIds: string[] = [];
  const haveExtras = await db.select().from(s.addonGroups).where(eq(s.addonGroups.isExtra, true));
  if (haveExtras.length) {
    groupIds.push(...haveExtras.map((g) => g.id));
  } else {
    const extras = items.filter((i) => i.isExtra);
    for (const [sort, g] of EXTRA_GROUPS.entries()) {
      const [row] = await db.insert(s.addonGroups).values({ name: g.name, minSelect: 0, maxSelect: g.maxSelect, sort, isExtra: true }).returning();
      groupIds.push(row.id);
      const mine = extras.filter((e) => extraPlacement(e.name).group === g.name);
      if (mine.length) {
        await db.insert(s.addons).values(
          mine.map((e, i) => ({
            groupId: row.id,
            name: e.name,
            pricePaise: e.variants[0].pricePaise,
            diet: extraDiet(e.name),
            icon: extraPlacement(e.name).icon,
            sort: i,
          })),
        );
      }
      summary.addons += mine.length;
    }
  }

  // Dishes
  const dishes = items.filter((i) => !i.isExtra);
  const existing = await db
    .select({ slug: s.menuItems.slug })
    .from(s.menuItems)
    .where(inArray(s.menuItems.slug, dishes.map((d) => d.slug)));
  const have = new Set(existing.map((e) => e.slug));

  for (const [i, d] of dishes.entries()) {
    if (have.has(d.slug)) continue;
    const categoryId = catIds.get(d.category);
    if (!categoryId) throw new Error(`Unknown category ${d.category}`);
    await db.transaction(async (tx) => {
      const [item] = await tx
        .insert(s.menuItems)
        .values({
          categoryId,
          slug: d.slug,
          name: d.name,
          description: d.description,
          diet: d.diet ?? (VEG_BY_INGREDIENTS.has(d.slug) ? "veg" : null),
          needsReview: d.needsReview,
          reviewNotes: d.issues.join(" ") || (ESTIMATED.has(d.slug) ? "Nutrition estimated on 2026-11-03 from USDA FoodData Central values for the listed ingredients; confirm with the kitchen." : null),
          sort: i,
        })
        .returning();
      await tx.insert(s.menuItemVariants).values(
        d.variants.map((v, vi) => ({
          menuItemId: item.id,
          label: v.label,
          portionAmount: v.portion?.amount ?? null,
          portionUnit: v.portion?.unit ?? null,
          pricePaise: v.pricePaise,
          diet: v.diet,
          kcal: v.nutrition?.kcal ?? null,
          proteinG: v.nutrition?.proteinG ?? null,
          carbsG: v.nutrition?.carbsG ?? null,
          fatG: v.nutrition?.fatG ?? null,
          fibreG: v.nutrition?.fibreG ?? null,
          sort: vi,
        })),
      );
      // Items needing owner review stay hidden from customers.
      await tx
        .insert(s.outletMenuItems)
        .values({ outletId: outlet.id, menuItemId: item.id, isAvailable: !d.needsReview });
      if (EXTRAS_ON.has(d.category)) {
        await tx.insert(s.menuItemAddonGroups).values(groupIds.map((groupId) => ({ menuItemId: item.id, groupId })));
      }
      summary.items++;
      summary.variants += d.variants.length;
      if (d.needsReview) summary.hidden.push(d.name);
    });
  }

  return { outletId: outlet.id, ...summary };
}

/** Test/dev helper: open the store all day, every day, so ordering can be exercised. */
export async function openAllDay(db: Db, outletId: string) {
  await db
    .update(s.storeSettings)
    .set({ hours: Array.from({ length: 7 }, () => ({ open: "00:00", close: "23:59" })) })
    .where(eq(s.storeSettings.outletId, outletId));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const conn = await openDb(process.env.DATABASE_URL ?? "pglite:./.data/pglite");
  await runMigrations(conn);
  const r = await seed(conn.db);
  console.log(
    `Seeded (${conn.kind}): outlet ${r.outlet}, categories ${r.categories}, dishes ${r.items}, variants ${r.variants}, extras ${r.addons}.`,
  );
  if (r.hidden.length) console.log(`Hidden until the owner confirms: ${r.hidden.join(", ")}`);
  if (process.argv.includes("--open-all-day")) {
    await openAllDay(conn.db, r.outletId);
    console.log("Dev only: opening hours set to all day. Change them in Admin > Settings.");
  }
  await conn.close();
}
