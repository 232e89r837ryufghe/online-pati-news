-- Online Pati News CMS — Migration
-- Adds missing columns to the 'posts' table

-- Add 'show_image' column for toggling featured image display
ALTER TABLE posts ADD COLUMN show_image INTEGER DEFAULT 1;

-- Add 'subheading' column (if missing)
-- NOTE: If this fails because the column already exists, you can ignore the error for this line.
ALTER TABLE posts ADD COLUMN subheading TEXT DEFAULT '';
