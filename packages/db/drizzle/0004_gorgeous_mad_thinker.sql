CREATE TABLE "area_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"pincode" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"area" text NOT NULL,
	"note" text,
	"contacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addon_groups" ADD COLUMN "is_extra" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "addons" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "area_requests" ADD CONSTRAINT "area_requests_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "area_requests_outlet_created" ON "area_requests" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "area_requests_pincode" ON "area_requests" USING btree ("pincode");--> statement-breakpoint
-- Split the single "Extras" group into Subway-style shelves (existing databases only;
-- a fresh database gets these groups from the seed). Add-on ids and prices are unchanged.
UPDATE "addon_groups" SET "is_extra" = true, "name" = 'Sauces & dips', "sort" = 3, "max_select" = 6 WHERE "name" = 'Extras';--> statement-breakpoint
INSERT INTO "addon_groups" ("name", "min_select", "max_select", "sort", "is_extra")
SELECT v.name, 0, v.max, v.sort, true
FROM (VALUES ('Proteins', 3, 0), ('Cheese', 1, 1), ('Veggies & toppings', 4, 2)) AS v(name, max, sort)
WHERE EXISTS (SELECT 1 FROM "addon_groups" WHERE "name" = 'Sauces & dips' AND "is_extra")
  AND NOT EXISTS (SELECT 1 FROM "addon_groups" g WHERE g."name" = v.name);--> statement-breakpoint
UPDATE "addons" a SET "group_id" = g."id"
FROM "addon_groups" g,
  (VALUES ('Tandoori Paneer', 'Proteins'), ('Chilli Tofu', 'Proteins'), ('Tandoori Chicken', 'Proteins'),
          ('Feta Cheese', 'Cheese'),
          ('Cherry Tomatoes', 'Veggies & toppings'), ('Olives', 'Veggies & toppings'), ('Broccoli', 'Veggies & toppings'), ('Avocado', 'Veggies & toppings')
  ) AS m(addon, grp)
WHERE a."name" = m.addon AND g."name" = m.grp AND g."is_extra";--> statement-breakpoint
INSERT INTO "menu_item_addon_groups" ("menu_item_id", "group_id")
SELECT l."menu_item_id", g."id"
FROM "menu_item_addon_groups" l
JOIN "addon_groups" s ON s."id" = l."group_id" AND s."name" = 'Sauces & dips' AND s."is_extra"
CROSS JOIN "addon_groups" g
WHERE g."is_extra" AND g."id" <> s."id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "addons" a SET "icon" = m.icon
FROM (VALUES ('Tandoori Paneer', 'paneer'), ('Chilli Tofu', 'tofu'), ('Tandoori Chicken', 'chicken'), ('Feta Cheese', 'cheese'),
             ('Cherry Tomatoes', 'tomato'), ('Olives', 'olive'), ('Broccoli', 'broccoli'), ('Avocado', 'avocado'),
             ('Pesto Sauce', 'sauce'), ('Italian Herb Dressing', 'leaf'), ('Honey Musterd Dip', 'dip'), ('Russian Dressing', 'sauce'),
             ('Peri Peri Dip', 'spice'), ('Guacamole', 'avocado')) AS m(name, icon)
WHERE a."name" = m.name AND a."icon" IS NULL;
