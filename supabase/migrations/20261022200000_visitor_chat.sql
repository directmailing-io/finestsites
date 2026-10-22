-- Besucher-Chat (Seitenbesucher ↔ Seitenbetreiber), 22.10.2026 – siehe docs/chat/konzept.md
--
--  * chat_conversations: ein Gespräch je (Seite, Besucher-Kennung). Vom Besucher-Token wird nur der
--    sha256-Hash gespeichert, die IP nur als Hash des Workers (nie im Klartext).
--  * chat_messages: Nachrichten (visitor | owner | system), clientId für Idempotenz/optimistische Anzeige.
--  * chat_blocks: vom Betreiber gesperrte Besucher (Token-Hash und/oder IP-Hash), gilt für alle Seiten des Kontos.
--  * chat_resume_tokens: einmalige Links aus der Antwort-Mail (30 Tage), gehasht.
--  * notification_preferences.chat: Push-Schalter „Chat“.
--  * push_outbox.category darf jetzt auch 'chat' sein.
--
-- Rein additiv und idempotent (mehrfach ausführbar). Die Funktion selbst ist über
-- app_settings (visitor_chat_enabled / visitor_chat_users) geschaltet, Standard AUS.

BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  site_id               UUID NOT NULL REFERENCES public.user_sites(id) ON DELETE CASCADE,
  visitor_token_hash    VARCHAR(64) NOT NULL,
  visitor_name          TEXT,
  visitor_email         TEXT,
  visitor_phone         TEXT,
  notify_by_email       BOOLEAN NOT NULL DEFAULT false,
  visitor_key           VARCHAR(8) NOT NULL,
  status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'archived', 'blocked')),
  started_on_path       TEXT,
  user_agent            TEXT,
  ip_hash               VARCHAR(64),
  owner_unread          INTEGER NOT NULL DEFAULT 0,
  visitor_unread        INTEGER NOT NULL DEFAULT 0,
  last_message_at       TIMESTAMPTZ,
  last_message_preview  TEXT,
  last_message_sender   TEXT,
  visitor_last_seen_at  TIMESTAMPTZ,
  owner_last_seen_at    TIMESTAMPTZ,
  reported_at           TIMESTAMPTZ,
  report_reason         TEXT,
  visitor_notified_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_conversations_site_visitor_unique UNIQUE (site_id, visitor_token_hash)
);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_status_updated
  ON public.chat_conversations(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_site_token
  ON public.chat_conversations(site_id, visitor_token_hash);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_reported
  ON public.chat_conversations(reported_at DESC) WHERE reported_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender           TEXT NOT NULL CHECK (sender IN ('visitor', 'owner', 'system')),
  body             TEXT NOT NULL CHECK (char_length(body) <= 2000),
  client_id        VARCHAR(64),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_client_unique
  ON public.chat_messages(conversation_id, sender, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
  ON public.chat_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.chat_blocks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  visitor_token_hash  VARCHAR(64),
  ip_hash             VARCHAR(64),
  reason              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_blocks_user_token ON public.chat_blocks(user_id, visitor_token_hash);
CREATE INDEX IF NOT EXISTS idx_chat_blocks_user_ip ON public.chat_blocks(user_id, ip_hash);

CREATE TABLE IF NOT EXISTS public.chat_resume_tokens (
  token_hash       VARCHAR(64) PRIMARY KEY,
  conversation_id  UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  expires_at       TIMESTAMPTZ NOT NULL,
  used_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_resume_tokens_expires ON public.chat_resume_tokens(expires_at);

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS chat BOOLEAN NOT NULL DEFAULT true;

-- Push-Kategorie 'chat' zulassen (CHECK-Constraint aus 20261021120000 erweitern)
ALTER TABLE public.push_outbox DROP CONSTRAINT IF EXISTS push_outbox_category_check;
ALTER TABLE public.push_outbox
  ADD CONSTRAINT push_outbox_category_check CHECK (category IN ('leads', 'support', 'account', 'partner', 'chat'));

-- Die App verbindet sich als Rolle "finestsites" (neue Tabellen brauchen die Rechte ausdrücklich).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finestsites') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO finestsites;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO finestsites;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_blocks TO finestsites;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_resume_tokens TO finestsites;
  END IF;
END $$;

COMMIT;
