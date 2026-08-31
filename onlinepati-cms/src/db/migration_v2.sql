-- Migration for Auth and Multi-Category support
ALTER TABLE users ADD COLUMN email TEXT;
CREATE TABLE IF NOT EXISTS post_categories (
  post_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, category_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Migrate existing category_id data to the new join table
INSERT OR IGNORE INTO post_categories (post_id, category_id)
SELECT id, category_id FROM posts WHERE category_id IS NOT NULL;
