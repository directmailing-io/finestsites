-- KI-Antwortvorschläge im Support-Chat (19.10.2026)
--  * support_ai_suggestions: jeder erzeugte Vorschlag mit Modell, Token-Verbrauch und – sobald der Admin
--    antwortet – dem tatsächlich gesendeten Text. Damit lässt sich später vergleichen, wie stark Daniel
--    die Vorschläge umschreibt (Grundlage, um Wissensbasis und Stilregeln nachzuschärfen).
--  * app_settings: kleiner Schlüssel/Wert-Speicher. Erster Schlüssel 'support_ai_notes' = aktuelle
--    Hinweise für die KI (Aktionen, bekannte Störungen), die Daniel direkt im Admin pflegt.
--
-- Idempotent (mehrfach ausführbar).

BEGIN;

CREATE TABLE IF NOT EXISTS public.support_ai_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  admin_id          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  model             TEXT NOT NULL,
  hint              TEXT,
  suggestion        TEXT NOT NULL,
  sent_content      TEXT,
  sent_at           TIMESTAMPTZ,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  cached_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms       INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ai_suggestions_conv ON public.support_ai_suggestions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_support_ai_suggestions_created ON public.support_ai_suggestions(created_at);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Die App verbindet sich als Rolle "finestsites" (neue Tabellen brauchen die Rechte ausdrücklich).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finestsites') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ai_suggestions TO finestsites;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO finestsites;
  END IF;
END $$;

COMMIT;
