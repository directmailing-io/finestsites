-- Tarifwechsel nach unten zum Laufzeitende (Daniel 28.10.2026, Anlass: Anfrage Michaela Marten).
--   users.pending_plan             = Zieltarif ('starter' | 'pro'), greift am Ende des bezahlten Zeitraums
--   users.pending_plan_interval    = Intervall des Zieltarifs ('monthly' | 'yearly'), immer = aktuelles Intervall
--   users.pending_plan_at          = Zeitpunkt des Wechsels (= current_period_end beim Einplanen)
--   users.pending_plan_schedule_id = Stripe Subscription Schedule (sub_sched_…), der den Preis umstellt
--   users.pending_keep_site_ids    = Webseiten, die nach dem Wechsel online bleiben (Rest wird Entwurf)
-- Nur ergänzend, keine Datenänderung.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pending_plan text,
  ADD COLUMN IF NOT EXISTS pending_plan_interval text,
  ADD COLUMN IF NOT EXISTS pending_plan_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_plan_schedule_id text,
  ADD COLUMN IF NOT EXISTS pending_keep_site_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pending_plan_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_pending_plan_check CHECK (pending_plan IS NULL OR pending_plan IN ('starter', 'pro', 'unlimited'));

COMMIT;
