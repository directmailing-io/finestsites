-- Besucher-Chat: Schalter je Webseite (Editor „Besucher-Chat anzeigen“). docs/chat/konzept.md
-- Nur ergänzend: neue Spalte mit Standardwert true – bestehende Daten/Abfragen unverändert.
BEGIN;
ALTER TABLE public.user_sites ADD COLUMN IF NOT EXISTS visitor_chat_enabled boolean NOT NULL DEFAULT true;
COMMIT;
