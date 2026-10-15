-- E-Mail-Benachrichtigungen je Nutzer: Welche Mail-Arten er NICHT mehr bekommen will.
-- Leer = alles erlaubt (Standard für jedes Konto). Die Kategorie "system" ist nie abwählbar.
-- Kategorien siehe src/lib/email/categories.ts (updates | tips | offers).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_opt_out            TEXT[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_opt_out_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.email_opt_out            IS 'Abbestellte Mail-Kategorien (updates|tips|offers); leer = alle erlaubt';
COMMENT ON COLUMN public.users.email_opt_out_updated_at IS 'Letzte Änderung der Mail-Einstellungen durch den Nutzer (Nachweis)';

CREATE INDEX IF NOT EXISTS idx_users_email_opt_out ON public.users USING GIN (email_opt_out);

-- Jede geloggte Mail trägt ihre Kategorie; status kennt neben sent|error jetzt auch skipped
-- (Empfänger hatte die Kategorie abbestellt, Mail wurde absichtlich nicht gesendet).
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Newsletter-Verlauf (Tabelle wurde ohne Migration angelegt, deshalb abgesichert)
DO $$
BEGIN
  IF to_regclass('public.newsletter_sends') IS NOT NULL THEN
    ALTER TABLE public.newsletter_sends
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS skipped  INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;
