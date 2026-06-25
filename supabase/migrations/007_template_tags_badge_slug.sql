-- Add tags, badge, slug to templates for landing page filtering and detail pages
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS tags       TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS badge      TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS slug       TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS detail_color TEXT  DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS templates_slug_idx ON templates(slug) WHERE slug IS NOT NULL;
