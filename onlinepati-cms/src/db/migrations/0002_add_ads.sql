-- Migration: Add Advertisements Table
CREATE TABLE IF NOT EXISTS advertisements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT DEFAULT '',
  position TEXT NOT NULL, -- e.g. 'home_top', 'sidebar', 'article_bottom'
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  expiry_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ads_status ON advertisements(status);
CREATE INDEX IF NOT EXISTS idx_ads_position ON advertisements(position);
