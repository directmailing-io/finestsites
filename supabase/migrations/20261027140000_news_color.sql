-- Neuigkeiten: wählbare Pastellfarbe je Neuigkeit (Daniel 26.10.2026: „verschiedene Farben zur Auswahl“).
--   news_posts.color = 'peach' | 'mint' | 'lavender' | 'apricot' | 'sky' | NULL
--   NULL = automatisch (deterministisch aus der ID, wie bisher). Nur ergänzend, keine Datenänderung.
BEGIN;

ALTER TABLE public.news_posts
  ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE public.news_posts DROP CONSTRAINT IF EXISTS news_posts_color_check;
ALTER TABLE public.news_posts
  ADD CONSTRAINT news_posts_color_check CHECK (color IS NULL OR color IN ('peach', 'mint', 'lavender', 'apricot', 'sky'));

COMMIT;
