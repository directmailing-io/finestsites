-- Besucher-Chat: Übergabe eines Gesprächs zwischen Browsern (z. B. Instagram-In-App-Browser → Safari).
-- Konzept: docs/chat/konzept.md, Abschnitt „Übergabe zwischen Browsern“.
--
--  * chat_visitor_tokens: weitere Besucher-Token (Alias) je Gespräch, gehasht. Der ursprüngliche Token
--    bleibt in chat_conversations.visitor_token_hash; ein eingelöster Resume-/Übergabe-Link ersetzt ihn
--    nicht mehr, sondern kommt hier dazu – beide Browser behalten den Zugang.
--  * chat_resume_tokens.kind: 'reply' (Link aus der Antwort-Mail, 30 Tage) | 'handoff' (Übergabe-Link,
--    7 Tage) | 'handoff_mail' (Übergabe-Link per Mail, 7 Tage). Dient auch der Drossel (3 Mails/Tag).
--
-- Nur ergänzend (neue Tabelle, neue Spalte mit Standardwert) – bestehende Daten werden nicht verändert.

BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_visitor_tokens (
  token_hash       varchar(64) PRIMARY KEY,
  conversation_id  uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_used_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_chat_visitor_tokens_conversation ON public.chat_visitor_tokens(conversation_id);

ALTER TABLE public.chat_resume_tokens ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'reply';
CREATE INDEX IF NOT EXISTS idx_chat_resume_tokens_conversation_kind ON public.chat_resume_tokens(conversation_id, kind, created_at);

-- Die App verbindet sich als Rolle "finestsites" (neue Tabellen brauchen die Rechte ausdrücklich).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finestsites') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_visitor_tokens TO finestsites;
  END IF;
END $$;

COMMIT;
