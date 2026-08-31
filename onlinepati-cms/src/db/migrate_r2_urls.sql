-- Migration script to update existing relative /cdn/ URLs to absolute R2 URLs
-- Run this if you want existing media to point directly to R2

UPDATE media 
SET url = 'https://mediaonlinepatinews.275ebc9494fdc9dc877845d7227e360e.r2.cloudflarestorage.com/uploads/' || REPLACE(key, 'uploads/', '')
WHERE url LIKE '/cdn/uploads/%';

UPDATE advertisements
SET image_url = 'https://mediaonlinepatinews.275ebc9494fdc9dc877845d7227e360e.r2.cloudflarestorage.com/uploads/' || REPLACE(image_url, '/cdn/uploads/', '')
WHERE image_url LIKE '/cdn/uploads/%';

UPDATE posts
SET featured_image = 'https://mediaonlinepatinews.275ebc9494fdc9dc877845d7227e360e.r2.cloudflarestorage.com/uploads/' || REPLACE(featured_image, '/cdn/uploads/', '')
WHERE featured_image LIKE '/cdn/uploads/%';
