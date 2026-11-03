-- Kündigungsprozess (03.11.2026, Daniel; Konzept docs/kuendigung/konzept.html):
--  * cancellation_feedback: Grund, Kommentar und Angebot je gestartetem Kündigungsflow (Auswertung im Admin)
--  * users: Treue-Rabatt (10 % dauerhaft, einmal pro Konto, ggf. vorgemerkt bis der laufende Rabatt endet),
--           Pause (1–3 Monate ab Laufzeitende per Stripe Subscription Schedule),
--           Erinnerung vor der Jahres-Verlängerung (Opt-in) und Marker für die neuen Lifecycle-Mails
--  * user_sites.status bekommt den Wert 'paused' (kein Enum, nur Text) – siehe src/lib/billing/pause.ts
--
-- Idempotent. Neue Tabellen brauchen GRANT an die Rolle finestsites (Lehre aus Werbung & Tracking).

BEGIN;

CREATE TABLE IF NOT EXISTS public.cancellation_feedback (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason                 TEXT NOT NULL,
  comment                TEXT,
  plan                   TEXT,
  billing_interval       TEXT,
  discount_at_time       TEXT,
  tenure_days            INTEGER,
  offer_shown            TEXT NOT NULL DEFAULT 'none',
  offer_result           TEXT,
  outcome                TEXT NOT NULL DEFAULT 'started',
  stripe_subscription_id TEXT,
  period_end             TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_user ON public.cancellation_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_created ON public.cancellation_feedback(created_at);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS retention_offer_shown_at   TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS retention_coupon_pending   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS retention_coupon_applied_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS renewal_reminder_opt_in    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS renewal_reminder_sent_at   TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pause_from                 TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pause_until                TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pause_months               INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pause_schedule_id          TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pause_started_at           TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pause_end_notice_sent_at   TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_pause_at              TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cancel_end_notice_sent_at  TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deletion_notice_sent_at    TIMESTAMPTZ;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cancellation_feedback TO finestsites;

COMMIT;
