-- Two more dish photos (2026-11-10): the fruit bowl from the owner's food artwork, the caprese from the reel's still. Keeps any photo already uploaded in Admin.
UPDATE menu_items SET image_url = '/menu/' || slug || '.webp', updated_at = now()
WHERE image_url IS NULL AND slug IN ('exotic-fresh-fruits-bowl', 'caprese-sandwich');
