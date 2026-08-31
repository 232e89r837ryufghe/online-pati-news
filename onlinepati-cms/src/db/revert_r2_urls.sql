-- Revert all media URLs to relative /cdn/ paths
UPDATE media SET url = '/cdn/uploads/' || REPLACE(url, 'https://mediaonlinepatinews.275ebc9494fdc9dc877845d7227e360e.r2.cloudflarestorage.com/uploads/', '') WHERE url LIKE 'http%';
UPDATE advertisements SET image_url = '/cdn/uploads/' || REPLACE(image_url, 'https://mediaonlinepatinews.275ebc9494fdc9dc877845d7227e360e.r2.cloudflarestorage.com/uploads/', '') WHERE image_url LIKE 'http%';
UPDATE posts SET featured_image = '/cdn/uploads/' || REPLACE(featured_image, 'https://mediaonlinepatinews.275ebc9494fdc9dc877845d7227e360e.r2.cloudflarestorage.com/uploads/', '') WHERE featured_image LIKE 'http%';
