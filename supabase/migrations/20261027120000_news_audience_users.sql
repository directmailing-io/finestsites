-- Neuigkeiten: Zielgruppe „Bestimmte Nutzer“ (zum Testen vor dem Rollout) + Sichtbarkeitsdauer (Daniel 26.10.2026).
--   news_posts.audience_user_ids = Konten, die eine Neuigkeit mit audience = 'users' sehen (sonst leer)
--   news_posts.expires_at        = „Sichtbar bis“ (Ende des Tages Europe/Berlin); NULL = bis zum Archivieren
-- Nur ergänzend, keine Datenänderung.
BEGIN;

ALTER TABLE public.news_posts
  ADD COLUMN IF NOT EXISTS audience_user_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.news_posts DROP CONSTRAINT IF EXISTS news_posts_audience_check;
ALTER TABLE public.news_posts
  ADD CONSTRAINT news_posts_audience_check CHECK (audience IN ('all', 'plan:starter', 'plan:pro', 'plan:unlimited', 'users'));

COMMIT;
