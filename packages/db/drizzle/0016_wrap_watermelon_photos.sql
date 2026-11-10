-- The last two dish photos (2026-11-10): Tandoori Wrap and Watermelon Mint Refresher. Keeps any photo already uploaded in Admin.
UPDATE menu_items SET image_url = '/menu/' || slug || '.webp', updated_at = now()
WHERE image_url IS NULL AND slug IN ('tandoori-wrap-paneer-chicken', 'watermelon-mint-refresher');
