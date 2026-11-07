/**
 * Extras shelves: a fresh seed builds them, and migration 0004 turns the old
 * single "Extras" group of a live database into the same shape, keeping ids.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { openDb } from "./client.ts";
import { migrationsFolder, runMigrations } from "./migrate.ts";
import { seed } from "./seed.ts";
import * as s from "./schema.ts";

const file = readdirSync(migrationsFolder).find((f) => f.startsWith("0004_"))!;
const regroupSql = readFileSync(join(migrationsFolder, file), "utf8")
  .split("--> statement-breakpoint")
  .map((x) => x.replace(/^\s*--.*$/gm, "").trim())
  .filter((x) => /^(UPDATE|INSERT)/.test(x));

const printSql = readFileSync(join(migrationsFolder, readdirSync(migrationsFolder).find((f) => f.startsWith("0005_"))!), "utf8")
  .split("--> statement-breakpoint")
  .map((x) => x.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

describe("migration 0005 (printed menu) on a live database", () => {
  it("names the salads, reprices quinoa, renames, and adds the juice held for review", async () => {
    const conn = await openDb("pglite:memory");
    await runMigrations(conn);
    const db = conn.db;
    const [outlet] = await db.insert(s.outlets).values({ slug: "versova", name: "V", addressLines: ["x"] }).returning();
    const cat = async (slug: string, name: string) => (await db.insert(s.categories).values({ slug, name }).returning())[0].id;
    const salads = await cat("salads", "Salads");
    await cat("juices", "Juices");
    const sm = await cat("smoothies", "Smoothies");
    const dish = async (categoryId: string, name: string, slug: string, needsReview: boolean, variants: { label: string; price: number }[]) => {
      const [m] = await db.insert(s.menuItems).values({ categoryId, slug, name, needsReview }).returning();
      await db.insert(s.menuItemVariants).values(variants.map((v, sort) => ({ menuItemId: m.id, label: v.label, pricePaise: v.price, sort })));
      await db.insert(s.outletMenuItems).values({ outletId: outlet.id, menuItemId: m.id, isAvailable: !needsReview });
      return m.id;
    };
    const tofu = await dish(salads, "Large (400g) 320", "large-400g-320", true, [{ label: "Large", price: 32000 }]);
    const quinoa = await dish(salads, "Healthy Quinoa Salad Bowl", "healthy-quinoa-salad-bowl", false, [{ label: "Small", price: 33000 }, { label: "Large", price: 38000 }]);
    await dish(sm, "Fresh Fruit Smoothie", "fresh-fruit-smoothie", false, [{ label: "", price: 23000 }]);

    for (const q of printSql) await db.execute(sql.raw(q));

    const [t] = await db.select().from(s.menuItems).where(eq(s.menuItems.id, tofu));
    expect(t).toMatchObject({ name: "Spicy Tofu Protein Salad Bowl", slug: "spicy-tofu-protein-salad-bowl", needsReview: false });
    const tv = await db.select().from(s.menuItemVariants).where(eq(s.menuItemVariants.menuItemId, tofu)).orderBy(s.menuItemVariants.sort);
    expect(tv.map((v) => [v.label, v.pricePaise, v.kcal])).toEqual([["Small", 29900, 370], ["Large", 32000, null]]);
    expect((await db.select().from(s.outletMenuItems).where(eq(s.outletMenuItems.menuItemId, tofu)))[0].isAvailable).toBe(true);

    const qv = await db.select().from(s.menuItemVariants).where(eq(s.menuItemVariants.menuItemId, quinoa));
    expect(qv.filter((v) => v.isActive).map((v) => [v.label, v.pricePaise, v.diet]).sort()).toEqual([["Chicken", 46000, "non_veg"], ["Veg", 38000, "veg"]]);
    expect((await db.select().from(s.menuItems).where(eq(s.menuItems.id, quinoa)))[0].needsReview).toBe(true);

    const names = (await db.select().from(s.menuItems)).map((m) => m.name).sort();
    expect(names).toEqual(["Healthy Quinoa Salad Bowl", "Mix Fruit Smoothie", "Pomegranate Juice", "Spicy Tofu Protein Salad Bowl"]);
    const [juice] = await db.select().from(s.menuItems).where(eq(s.menuItems.slug, "pomegranate-juice"));
    expect(juice.needsReview).toBe(true);
    expect((await db.select().from(s.categories).where(eq(s.categories.slug, "salads")))[0].name).toBe("Fresh Salads");
    await conn.close();
  });
});

describe("fresh seed", () => {
  it("puts the 14 extras on four shelves and offers every shelf on salads", async () => {
    const conn = await openDb("pglite:memory");
    await runMigrations(conn);
    await seed(conn.db);
    await seed(conn.db); // re-run adds nothing
    const groups = await conn.db.select().from(s.addonGroups).orderBy(s.addonGroups.sort);
    expect(groups.map((g) => g.name)).toEqual(["Proteins", "Cheese", "Veggies & toppings", "Sauces & dips"]);
    expect(groups.every((g) => g.isExtra)).toBe(true);
    const extras = await conn.db.select().from(s.addons);
    expect(extras).toHaveLength(14);
    expect(extras.every((a) => a.icon)).toBe(true);
    const [salad] = await conn.db.select().from(s.categories).where(eq(s.categories.slug, "salads"));
    const [dish] = await conn.db.select().from(s.menuItems).where(eq(s.menuItems.categoryId, salad.id)).limit(1);
    const links = await conn.db.select().from(s.menuItemAddonGroups).where(eq(s.menuItemAddonGroups.menuItemId, dish.id));
    expect(links).toHaveLength(4);

    // Every dish and extra carries a diet mark, on the dish or on each of its options.
    const unmarked = await conn.db.execute(sql.raw(
      "select m.name from menu_items m where m.diet is null and exists (select 1 from menu_item_variants v where v.menu_item_id = m.id and v.is_active and v.diet is null)",
    ));
    expect(Array.isArray(unmarked) ? unmarked : (unmarked as unknown as { rows: unknown[] }).rows).toEqual([]);
    expect(extras.filter((a) => !a.diet).map((a) => a.name)).toEqual([]);
    const [outlet] = await conn.db.select().from(s.outlets);
    expect(outlet.phone).toBe("+91 95847 58479");
    await conn.close();
  });
});

describe("migration 0004 on a live database", () => {
  let conn: Awaited<ReturnType<typeof openDb>>;
  let dishId: string;
  let ids: Record<string, string>;

  beforeAll(async () => {
    conn = await openDb("pglite:memory");
    await runMigrations(conn);
    // The pre-0004 shape: one "Extras" group linked to a dish.
    const [g] = await conn.db.insert(s.addonGroups).values({ name: "Extras", maxSelect: 14 }).returning();
    const rows = await conn.db
      .insert(s.addons)
      .values(["Tandoori Chicken", "Feta Cheese", "Avocado", "Peri Peri Dip"].map((name, sort) => ({ groupId: g.id, name, pricePaise: 5000, sort })))
      .returning();
    ids = Object.fromEntries(rows.map((r) => [r.name, r.id]));
    const [cat] = await conn.db.insert(s.categories).values({ slug: "salads", name: "Salads" }).returning();
    const [dish] = await conn.db.insert(s.menuItems).values({ categoryId: cat.id, slug: "x", name: "X" }).returning();
    dishId = dish.id;
    await conn.db.insert(s.menuItemAddonGroups).values({ menuItemId: dish.id, groupId: g.id });
  });

  it("moves each extra to its shelf without changing ids, and is safe to repeat", async () => {
    for (let run = 0; run < 2; run++) for (const q of regroupSql) await conn.db.execute(sql.raw(q));

    const groups = await conn.db.select().from(s.addonGroups);
    expect(groups.map((g) => g.name).sort()).toEqual(["Cheese", "Proteins", "Sauces & dips", "Veggies & toppings"]);
    const byId = new Map(groups.map((g) => [g.id, g.name]));
    const extras = await conn.db.select().from(s.addons);
    const shelf = Object.fromEntries(extras.map((a) => [a.name, { group: byId.get(a.groupId), id: a.id, icon: a.icon }]));
    expect(shelf["Tandoori Chicken"]).toEqual({ group: "Proteins", id: ids["Tandoori Chicken"], icon: "chicken" });
    expect(shelf["Feta Cheese"].group).toBe("Cheese");
    expect(shelf["Avocado"].group).toBe("Veggies & toppings");
    expect(shelf["Peri Peri Dip"].group).toBe("Sauces & dips");
    const links = await conn.db.select().from(s.menuItemAddonGroups).where(eq(s.menuItemAddonGroups.menuItemId, dishId));
    expect(links).toHaveLength(4);
    await conn.close();
  });
});
