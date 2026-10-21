-- Native App (Expo, iPhone/iPad) – Fundament für Push und interne Konten (21.10.2026)
--
--  * users.is_internal: Kennzeichen für interne Konten (z. B. Apple-Demo-Konto). Standard false,
--    ändert für bestehende Konten nichts. Ausnahmen (Rundmails, Statistik, Auszahlungen,
--    Mahnwesen) werden in eigenen Schritten im Code ergänzt.
--  * push_devices: Expo-Push-Token je Gerät (ein Token gehört immer genau einem Nutzer).
--  * notification_preferences: Push-Einstellungen je Nutzer (fehlende Zeile = Standardwerte).
--  * push_outbox: Warteschlange. Auslöser schreiben nur hier hinein, ein Cron arbeitet sie mit
--    FOR UPDATE SKIP LOCKED ab (sicher mit zwei PM2-Prozessen, nichts geht beim Neustart verloren).
--  * push_deliveries: ein Eintrag je Gerät und Mitteilung inkl. Expo-Ticket und Empfangsbestätigung.
--
-- Rein additiv und idempotent (mehrfach ausführbar). Versand ist standardmäßig AUS
-- (env PUSH_ENABLED=true UND app_settings.push_enabled='true' nötig).

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.users.is_internal IS 'Internes Konto (z. B. Apple-Demo): von Rundmails, Statistik, Auszahlungen, Mahnwesen auszunehmen';

CREATE TABLE IF NOT EXISTS public.push_devices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expo_token       TEXT NOT NULL UNIQUE,
  platform         TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  app_version      TEXT,
  os_version       TEXT,
  device_model     TEXT,
  locale           TEXT,
  enabled          BOOLEAN NOT NULL DEFAULT true,
  disabled_reason  TEXT,           -- 'user' | 'device_not_registered' | 'logout' | 'limit'
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_devices_user ON public.push_devices(user_id) WHERE enabled;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id              UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  leads                BOOLEAN NOT NULL DEFAULT true,
  support              BOOLEAN NOT NULL DEFAULT true,
  account              BOOLEAN NOT NULL DEFAULT true,
  partner              BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_enabled  BOOLEAN NOT NULL DEFAULT true,
  quiet_start_hour     SMALLINT NOT NULL DEFAULT 21 CHECK (quiet_start_hour BETWEEN 0 AND 23),
  quiet_end_hour       SMALLINT NOT NULL DEFAULT 8  CHECK (quiet_end_hour BETWEEN 0 AND 23),
  timezone             TEXT NOT NULL DEFAULT 'Europe/Berlin',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_outbox (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK (category IN ('leads', 'support', 'account', 'partner')),
  type          TEXT NOT NULL,     -- z. B. 'submission' | 'support_reply' | 'impersonation_request' | 'domain_active' | 'payment_notice'
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  collapse_key  TEXT,              -- gleicher Schlüssel innerhalb der Sperrzeit = keine zweite Mitteilung
  notification_id UUID REFERENCES public.user_notifications(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  skip_reason   TEXT,              -- 'disabled' | 'category_off' | 'no_devices' | 'throttled' | 'expired'
  attempts      INTEGER NOT NULL DEFAULT 0,
  not_before    TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at     TIMESTAMPTZ,
  last_error    TEXT,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_outbox_due ON public.push_outbox(not_before) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_push_outbox_processing ON public.push_outbox(locked_at) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_push_outbox_user_collapse ON public.push_outbox(user_id, collapse_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_outbox_user_sent ON public.push_outbox(user_id, sent_at DESC) WHERE status = 'sent';

CREATE TABLE IF NOT EXISTS public.push_deliveries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id           UUID NOT NULL REFERENCES public.push_outbox(id) ON DELETE CASCADE,
  device_id           UUID REFERENCES public.push_devices(id) ON DELETE SET NULL,
  ticket_id           TEXT,
  status              TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error               TEXT,
  receipt_status      TEXT CHECK (receipt_status IN ('ok', 'error')),
  receipt_error       TEXT,
  receipt_checked_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_outbox ON public.push_deliveries(outbox_id);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_receipt_due ON public.push_deliveries(created_at)
  WHERE status = 'ok' AND receipt_status IS NULL AND ticket_id IS NOT NULL;

-- Ungelesen-Zähler der Mitteilungen (Tabelle existiert seit Anfang, war bisher ungenutzt)
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created ON public.user_notifications(user_id, created_at DESC);

-- Die App verbindet sich als Rolle "finestsites" (neue Tabellen brauchen die Rechte ausdrücklich).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finestsites') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO finestsites;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO finestsites;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_outbox TO finestsites;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_deliveries TO finestsites;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notifications TO finestsites;
  END IF;
END $$;

COMMIT;
