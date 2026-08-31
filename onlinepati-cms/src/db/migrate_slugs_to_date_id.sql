-- Migration: Convert existing post slugs to ymdID format (e.g., 20240416123)
-- This matches the new backend logic for post creation and ensures consistent URL structures.

UPDATE posts 
SET slug = strftime('%Y%m%d', created_at) || id
WHERE 
  -- Update if slug contains alphabets, hyphens, or is shorter than a standard YYYYMMDD+ID
  (slug GLOB '*[a-zA-Z-]*') 
  OR (length(slug) < 9)
  -- Also ensure created_at is not null
  AND created_at IS NOT NULL;
