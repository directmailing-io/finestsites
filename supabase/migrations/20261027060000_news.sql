-- Neuigkeiten (Ankündigungen) für Web + App mit Push (Daniel 26.10.2026, Konzept docs/app/neuigkeiten-konzept.html).
--   news_posts  = eine Neuigkeit (Entwurf → veröffentlicht → archiviert), Push-Titel/-Text getrennt vom Inhalt
--   news_reads  = je Nutzer: gelesen / Knopf getippt / Startkarte weggewischt
--   notification_preferences.news = Schalter „Neuigkeiten von FinestSites“ (Standard an, jederzeit aus)
-- Nur ergänzend, keine Datenänderung.
BEGIN;

CREATE TABLE IF NOT EXISTS public.news_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  title           text NOT NULL,                          -- Überschrift der Neuigkeit (max. 80)
  push_title      text NOT NULL,                          -- Titel der Mitteilung (max. 40)
  push_body       text NOT NULL,                          -- Text der Mitteilung (max. 170, Richtwert 110)
  body            text NOT NULL,                          -- Inhalt: Absätze durch Leerzeile, Zeilen mit "- " = Aufzählung
  cta_label       text,                                   -- Knopf (max. 30), NULL = kein Knopf
  cta_kind        text CHECK (cta_kind IS NULL OR cta_kind IN ('sites', 'submissions', 'chats', 'affiliate', 'settings', 'url')),
  cta_url         text,                                   -- nur bei cta_kind = 'url' (https://…)
  audience        text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'plan:starter', 'plan:pro', 'plan:unlimited')),
  published_at    timestamptz,
  push_sent_at    timestamptz,
  push_queued     integer NOT NULL DEFAULT 0,             -- Anzahl Nutzer, für die eine Mitteilung eingereiht wurde
  created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_news_posts_published ON public.news_posts(published_at DESC) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.news_reads (
  news_id         uuid NOT NULL REFERENCES public.news_posts(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at         timestamptz,
  cta_clicked_at  timestamptz,
  dismissed_at    timestamptz,                            -- Startkarte weggewischt (Web + App)
  PRIMARY KEY (news_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_news_reads_user ON public.news_reads(user_id);

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS news BOOLEAN NOT NULL DEFAULT true;

-- Push-Kategorie 'news' zulassen
ALTER TABLE public.push_outbox DROP CONSTRAINT IF EXISTS push_outbox_category_check;
ALTER TABLE public.push_outbox
  ADD CONSTRAINT push_outbox_category_check CHECK (category IN ('leads', 'support', 'account', 'partner', 'chat', 'news'));

-- Die App verbindet sich als Rolle "finestsites" (neue Tabellen brauchen die Rechte ausdrücklich).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finestsites') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_posts TO finestsites;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_reads TO finestsites;
  END IF;
END $$;

COMMIT;
