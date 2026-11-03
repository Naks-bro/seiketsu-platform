-- Corrections from the owner's printed menu (Downloads/Seiketsu Menu.pdf), for databases
-- seeded before it. A fresh database gets the same result from the updated seed data.

-- The two unnamed salads get their names and Small sizes (nutrition was already supplied).
WITH it AS (
  UPDATE "menu_items" SET "name" = 'Spicy Tofu Protein Salad Bowl', "slug" = 'spicy-tofu-protein-salad-bowl', "needs_review" = false, "review_notes" = NULL
  WHERE "name" = 'Large (400g) 320' AND NOT EXISTS (SELECT 1 FROM "menu_items" WHERE "slug" = 'spicy-tofu-protein-salad-bowl')
  RETURNING "id"
)
INSERT INTO "menu_item_variants" ("menu_item_id", "label", "portion_amount", "portion_unit", "price_paise", "kcal", "protein_g", "carbs_g", "fat_g", "fibre_g", "sort")
SELECT "id", 'Small', 300, 'g', 29900, 370, 18, 23, 24, 8, 0 FROM it;--> statement-breakpoint
WITH it AS (
  UPDATE "menu_items" SET "name" = 'Fresh Zucchini Noodles Salad Bowl', "slug" = 'fresh-zucchini-noodles-salad-bowl', "needs_review" = false, "review_notes" = NULL
  WHERE "name" = 'Large (450g) 350' AND NOT EXISTS (SELECT 1 FROM "menu_items" WHERE "slug" = 'fresh-zucchini-noodles-salad-bowl')
  RETURNING "id"
)
INSERT INTO "menu_item_variants" ("menu_item_id", "label", "portion_amount", "portion_unit", "price_paise", "kcal", "protein_g", "carbs_g", "fat_g", "fibre_g", "sort")
SELECT "id", 'Small', 350, 'g', 30000, 260, 6, 25, 16, 7, 0 FROM it;--> statement-breakpoint
UPDATE "menu_item_variants" v SET "sort" = 1
FROM "menu_items" m
WHERE m."id" = v."menu_item_id" AND m."slug" IN ('spicy-tofu-protein-salad-bowl', 'fresh-zucchini-noodles-salad-bowl') AND v."label" = 'Large';--> statement-breakpoint
UPDATE "outlet_menu_items" o SET "is_available" = true
FROM "menu_items" m
WHERE m."id" = o."menu_item_id" AND m."slug" IN ('spicy-tofu-protein-salad-bowl', 'fresh-zucchini-noodles-salad-bowl') AND NOT m."needs_review";--> statement-breakpoint

-- Healthy Quinoa Salad Bowl is now Veg (450g) 380 / Chicken (450g) 460. The old sizes stay
-- in the database (past orders point at them) but are switched off. Nutrition was given per
-- Small/Large, so it is held for the owner to re-supply before it shows again.
UPDATE "menu_item_variants" v SET "is_active" = false
FROM "menu_items" m
WHERE m."id" = v."menu_item_id" AND m."name" = 'Healthy Quinoa Salad Bowl' AND v."label" IN ('Small', 'Large');--> statement-breakpoint
INSERT INTO "menu_item_variants" ("menu_item_id", "label", "portion_amount", "portion_unit", "price_paise", "diet", "sort")
SELECT m."id", v.label, 450, 'g', v.price, v.diet::"diet", v.sort
FROM "menu_items" m
CROSS JOIN (VALUES ('Veg', 38000, 'veg', 0), ('Chicken', 46000, 'non_veg', 1)) AS v(label, price, diet, sort)
WHERE m."name" = 'Healthy Quinoa Salad Bowl'
  AND NOT EXISTS (SELECT 1 FROM "menu_item_variants" x WHERE x."menu_item_id" = m."id" AND x."label" = v.label);--> statement-breakpoint
UPDATE "menu_items" SET "needs_review" = true,
  "review_notes" = 'Prices updated from the printed menu: Veg (450g) 380, Chicken (450g) 460. Add nutrition for each option, then tick Show on menu.'
WHERE "name" = 'Healthy Quinoa Salad Bowl' AND NOT "needs_review";--> statement-breakpoint

-- Names as printed.
UPDATE "menu_items" i SET "name" = r.new_name, "slug" = r.new_slug
FROM (VALUES
  ('Avocado Toast – Veg / Egg', 'Avocado Toast', 'avocado-toast'),
  ('Tandoori Grill – Paneer / Chicken', 'Tandoori Grill', 'tandoori-grill'),
  ('Exotic Fresh Fruit Bowl', 'Exotic Fresh Fruits Bowl', 'exotic-fresh-fruits-bowl'),
  ('Fresh Fruit Smoothie', 'Mix Fruit Smoothie', 'mix-fruit-smoothie')
) AS r(old_name, new_name, new_slug)
WHERE i."name" = r.old_name AND NOT EXISTS (SELECT 1 FROM "menu_items" x WHERE x."slug" = r.new_slug);--> statement-breakpoint
UPDATE "categories" c SET "name" = r.title
FROM (VALUES ('salads', 'Salads', 'Fresh Salads'), ('meals', 'Meals', 'Wholesome Meals'), ('juices', 'Juices', 'Fresh-Pressed Juices')) AS r(slug, old_name, title)
WHERE c."slug" = r.slug AND c."name" = r.old_name;--> statement-breakpoint

-- New on the printed menu: Pomegranate Juice, (300ml) 240. No description or nutrition was
-- supplied, so it waits in the admin for the owner to complete and switch on.
INSERT INTO "menu_items" ("category_id", "slug", "name", "needs_review", "review_notes", "sort")
SELECT c."id", 'pomegranate-juice', 'Pomegranate Juice', true,
  'Added from the printed menu: (300ml) 240. Add a description and nutrition, then tick Show on menu.', 36
FROM "categories" c
WHERE c."slug" = 'juices' AND NOT EXISTS (SELECT 1 FROM "menu_items" WHERE "slug" = 'pomegranate-juice');--> statement-breakpoint
INSERT INTO "menu_item_variants" ("menu_item_id", "portion_amount", "portion_unit", "price_paise", "sort")
SELECT m."id", 300, 'ml', 24000, 0 FROM "menu_items" m
WHERE m."slug" = 'pomegranate-juice' AND NOT EXISTS (SELECT 1 FROM "menu_item_variants" v WHERE v."menu_item_id" = m."id");--> statement-breakpoint
INSERT INTO "outlet_menu_items" ("outlet_id", "menu_item_id", "is_available")
SELECT o."id", m."id", false FROM "outlets" o CROSS JOIN "menu_items" m WHERE m."slug" = 'pomegranate-juice'
ON CONFLICT DO NOTHING;
