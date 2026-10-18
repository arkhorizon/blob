-- Reading counts intentionally start from zero in Shiye 2.0.
CREATE TABLE IF NOT EXISTS article_views (
  slug TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0)
);
