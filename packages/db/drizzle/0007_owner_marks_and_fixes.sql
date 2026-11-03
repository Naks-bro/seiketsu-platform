-- Owner's answers (2026-11-03). Safe to run more than once.
UPDATE outlets SET phone = '+91 95847 58479', whatsapp = '919584758479' WHERE phone = '+91 79776 97408';
--> statement-breakpoint
UPDATE categories SET name = 'Fresh-Pressed Juices' WHERE slug = 'juices';
--> statement-breakpoint
UPDATE menu_items SET diet = 'veg' WHERE diet IS NULL AND slug IN ('avocado-smoothie', 'beetroot-apple-carrot', 'broccoli-corn-salad-bowl', 'celery-green-apple-carrot', 'chocolate-smoothie', 'creamy-italian-herb-pasta-bowl', 'cucumber-and-avocado-salad-bowl', 'cucumber-watermelon-salad-bowl', 'exotic-apple-salad-bowl', 'exotic-fresh-fruits-bowl', 'fresh-zucchini-noodles-salad-bowl', 'green-machine', 'italian-pesto-pasta-bowl', 'mediterranean-salad-bowl', 'mix-fruit-smoothie', 'pomegranate-juice', 'red-sauce-pasta-bowl', 'spicy-tofu-protein-salad-bowl', 'sprouts-protein-salad-bowl', 'sunrise-kick', 'watermelon-beetroot-lime', 'watermelon-mint-refresher');
--> statement-breakpoint
UPDATE addons SET diet = 'veg' WHERE diet IS NULL AND name IN ('Avocado', 'Broccoli', 'Cherry Tomatoes', 'Chilli Tofu', 'Feta Cheese', 'Guacamole', 'Honey Musterd Dip', 'Italian Herb Dressing', 'Olives', 'Peri Peri Dip', 'Pesto Sauce', 'Russian Dressing');
--> statement-breakpoint
UPDATE menu_items SET description = 'Freshly pressed watermelon with fresh mint.' WHERE slug = 'watermelon-mint-refresher' AND description LIKE 'A crisp, refreshing combination of celery%';
--> statement-breakpoint
UPDATE menu_items SET description = 'Freshly pressed pomegranate.' WHERE slug = 'pomegranate-juice' AND coalesce(description, '') = '';
--> statement-breakpoint
UPDATE menu_item_variants SET kcal = 414, protein_g = 10, carbs_g = 54, fat_g = 19, fibre_g = 10 WHERE is_active AND kcal IS NULL AND label = 'Veg' AND menu_item_id = (SELECT id FROM menu_items WHERE slug = 'healthy-quinoa-salad-bowl');
--> statement-breakpoint
UPDATE menu_item_variants SET kcal = 519, protein_g = 39, carbs_g = 43, fat_g = 22, fibre_g = 8 WHERE is_active AND kcal IS NULL AND label = 'Chicken' AND menu_item_id = (SELECT id FROM menu_items WHERE slug = 'healthy-quinoa-salad-bowl');
--> statement-breakpoint
UPDATE menu_item_variants SET kcal = 165, protein_g = 0, carbs_g = 40, fat_g = 1, fibre_g = 0 WHERE is_active AND kcal IS NULL AND true AND menu_item_id = (SELECT id FROM menu_items WHERE slug = 'pomegranate-juice');
--> statement-breakpoint
UPDATE menu_items SET needs_review = false, review_notes = 'Nutrition estimated on 2026-11-03 from USDA FoodData Central values for the listed ingredients; confirm with the kitchen.' WHERE slug IN ('healthy-quinoa-salad-bowl', 'pomegranate-juice') AND needs_review;
--> statement-breakpoint
UPDATE outlet_menu_items SET is_available = true WHERE menu_item_id IN (SELECT id FROM menu_items WHERE slug IN ('healthy-quinoa-salad-bowl', 'pomegranate-juice'));
