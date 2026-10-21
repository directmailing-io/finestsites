-- Konto löschen (App Store 5.1.1(v), Web und App) – 22.10.2026
--
--  * users.deletion_requested_at / deletion_scheduled_for: Löschung angefragt, 14 Tage Bedenkzeit.
--    users.deleted_at: Löschung ausgeführt. Die Zeile bleibt als „Grabstein“ stehen (id + Benutzername,
--    damit Links und Empfehlungen nie auf eine andere Person zeigen), alle persönlichen Felder sind leer.
--  * account_deletion_requests: Protokoll jeder Anfrage (auch abgebrochene), Wahl beim Partner-Guthaben
--    (Auszahlung oder ausdrücklicher Verzicht inkl. Wortlaut), Stand der Schlussabrechnung.
--  * retention_until auf affiliate_commissions / affiliate_payouts: bis wann die Buchung aufbewahrt
--    werden muss (Frist beginnt mit Ende des Kalenderjahres, § 147 Abs. 4 AO).
--  * affiliate_commissions.status bekommt 'waived' (Verzicht des Partners bei Kontolöschung).
--  * affiliate_clicks.converted_user_id: ON DELETE SET NULL (vorher ohne Regel → hätte jedes harte
--    Löschen eines Nutzers blockiert).
--
-- Rein additiv und idempotent (mehrfach ausführbar). Ändert nichts an bestehenden Konten.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deletion_requested_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at             TIMESTAMPTZ;

COMMENT ON COLUMN public.users.deletion_requested_at  IS 'Kontolöschung angefragt (Bedenkzeit läuft); NULL = keine Anfrage';
COMMENT ON COLUMN public.users.deletion_scheduled_for IS 'Ab diesem Zeitpunkt führt der Cron /api/cron/account-deletion die Löschung aus';
COMMENT ON COLUMN public.users.deleted_at             IS 'Konto gelöscht; Zeile ist nur noch Grabstein (id, Benutzername reserviert)';

CREATE INDEX IF NOT EXISTS idx_users_deletion_due
  ON public.users(deletion_scheduled_for)
  WHERE deletion_requested_at IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Grabstein-Zeile bleibt bestehen; RESTRICT verhindert, dass das Protokoll still verschwindet
  user_id                  UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status                   TEXT NOT NULL DEFAULT 'scheduled'
                             CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  source                   TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'app', 'admin')),
  requested_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for            TIMESTAMPTZ NOT NULL,
  cancelled_at             TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  -- Partner-Guthaben zum Zeitpunkt der Anfrage (Cent) und die ausdrückliche Wahl
  balance_available_cents  INTEGER NOT NULL DEFAULT 0,
  balance_pending_cents    INTEGER NOT NULL DEFAULT 0,
  -- bereits gutgeschriebenes, noch nicht verrechnetes Stripe-Kundenguthaben (AGB § 16 Abs. 3: auf Anfrage auszahlbar)
  balance_customer_credit_cents INTEGER NOT NULL DEFAULT 0,
  balance_choice           TEXT NOT NULL DEFAULT 'none' CHECK (balance_choice IN ('none', 'payout', 'waive')),
  waiver_text              TEXT,           -- genauer Wortlaut der Verzichtserklärung
  waiver_accepted_at       TIMESTAMPTZ,
  -- Schlussabrechnung nach der Löschung
  settlement_status        TEXT NOT NULL DEFAULT 'not_needed'
                             CHECK (settlement_status IN ('not_needed', 'pending', 'settled', 'payable_on_request', 'waived', 'time_barred')),
  settled_at               TIMESTAMPTZ,
  -- Nur solange ein Guthaben auf Anfrage auszahlbar ist (kein Auszahlungskonto): Kontaktadresse,
  -- wird bei Erledigung bzw. nach limitation_until geleert
  contact_email            TEXT,
  limitation_until         DATE,           -- Verjährung (§§ 195, 199 BGB: 3 Jahre ab Jahresende)
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user ON public.account_deletion_requests(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_requests_one_open
  ON public.account_deletion_requests(user_id) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_settlement
  ON public.account_deletion_requests(settlement_status) WHERE settlement_status IN ('pending', 'payable_on_request');

-- Aufbewahrungsfristen der Partner-Buchungen (gesetzt beim Löschen eines beteiligten Kontos)
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS retention_until DATE;
ALTER TABLE public.affiliate_payouts     ADD COLUMN IF NOT EXISTS retention_until DATE;
COMMENT ON COLUMN public.affiliate_commissions.retention_until IS 'Aufbewahrung bis (10 Jahre, § 147 Abs. 1 Nr. 1 AO, ab Jahresende)';
COMMENT ON COLUMN public.affiliate_payouts.retention_until     IS 'Aufbewahrung bis (Gutschrift 8 Jahre § 147 Abs. 1 Nr. 4/Abs. 3 AO, § 14b UStG; Auszahlungsbuchung 10 Jahre) – der längere Wert';

-- Provisionsstatus 'waived' (Verzicht bei Kontolöschung)
ALTER TABLE public.affiliate_commissions DROP CONSTRAINT IF EXISTS affiliate_commissions_status_check;
ALTER TABLE public.affiliate_commissions ADD CONSTRAINT affiliate_commissions_status_check
  CHECK (status = ANY (ARRAY['pending', 'available', 'processing', 'paid', 'cancelled', 'reversed', 'failed', 'waived'])) NOT VALID;

-- affiliate_clicks.converted_user_id → ON DELETE SET NULL (Name des alten Constraints unterscheidet sich je Umgebung)
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.affiliate_clicks'::regclass AND con.contype = 'f' AND a.attname = 'converted_user_id'
  LOOP
    EXECUTE format('ALTER TABLE public.affiliate_clicks DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_converted_user_id_fkey
    FOREIGN KEY (converted_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- Die App verbindet sich als Rolle "finestsites" (neue Tabellen brauchen die Rechte ausdrücklich).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finestsites') THEN
    GRANT SELECT, INSERT, UPDATE ON public.account_deletion_requests TO finestsites;
  END IF;
END $$;

COMMIT;
