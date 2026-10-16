-- Partner-Auszahlungen mit Gutschriften (§ 14 Abs. 2 Satz 2 UStG), 16.10.2026
--  * affiliate_tax_profiles: Angaben des Partners (nur Unternehmer: kleinunternehmer | regelbesteuert)
--  * affiliate_credit_note_counters: lückenloser Nummernkreis GS-YYYY-NNNNN je Jahr
--  * affiliate_payouts: Beträge (netto/USt/brutto), Snapshot, Positionen, Gutschrift-Nr./PDF-Schlüssel
--  * Aufbewahrung (§ 147 AO): FKs auf users von CASCADE auf SET NULL, Spalten nullable
--  * commission_rate-Default 0.15 → 0.10
--  * Status-Checks an die tatsächlich verwendeten Werte angepasst (processing, paid, completed, cancelled …)
--
-- Idempotent (mehrfach ausführbar). Funktioniert mit beiden bekannten Tabellenformen
-- (alte Supabase-Struktur und 006_affiliate_system.sql). Neue CHECK-/FK-Constraints werden
-- NOT VALID angelegt, damit Altbestand die Migration nie blockiert (neue Zeilen werden geprüft).

BEGIN;

-- ─── 1. affiliate_commissions ────────────────────────────────────────────────
ALTER TABLE public.affiliate_commissions
  ADD COLUMN IF NOT EXISTS net_amount      INTEGER,
  ADD COLUMN IF NOT EXISTS payout_id       UUID,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

ALTER TABLE public.affiliate_commissions ALTER COLUMN referrer_id DROP NOT NULL;
ALTER TABLE public.affiliate_commissions ALTER COLUMN referee_id  DROP NOT NULL;
ALTER TABLE public.affiliate_commissions ALTER COLUMN commission_rate SET DEFAULT 0.10;

ALTER TABLE public.affiliate_commissions DROP CONSTRAINT IF EXISTS affiliate_commissions_status_check;
ALTER TABLE public.affiliate_commissions ADD CONSTRAINT affiliate_commissions_status_check
  CHECK (status IN ('pending', 'available', 'processing', 'paid', 'cancelled', 'reversed', 'failed')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_commissions_payout ON public.affiliate_commissions (payout_id) WHERE payout_id IS NOT NULL;

-- ─── 2. affiliate_payouts: fehlende Altspalten + neue Belegspalten ───────────
ALTER TABLE public.affiliate_payouts
  ADD COLUMN IF NOT EXISTS commission_ids        UUID[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS commission_count      INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount          INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS period_start          DATE,
  ADD COLUMN IF NOT EXISTS period_end            DATE,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id    TEXT,
  ADD COLUMN IF NOT EXISTS payout_method         TEXT DEFAULT 'stripe_connect',
  ADD COLUMN IF NOT EXISTS pdf_url               TEXT,
  ADD COLUMN IF NOT EXISTS notes                 TEXT,
  ADD COLUMN IF NOT EXISTS paid_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS net_amount            INTEGER,
  ADD COLUMN IF NOT EXISTS vat_amount            INTEGER,
  ADD COLUMN IF NOT EXISTS gross_amount          INTEGER,
  ADD COLUMN IF NOT EXISTS vat_rate              NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS tax_status            TEXT,
  ADD COLUMN IF NOT EXISTS tax_profile_snapshot  JSONB,
  ADD COLUMN IF NOT EXISTS line_items            JSONB,
  ADD COLUMN IF NOT EXISTS credit_note_number    TEXT,
  ADD COLUMN IF NOT EXISTS credit_note_date      DATE,
  ADD COLUMN IF NOT EXISTS credit_note_key       TEXT,
  ADD COLUMN IF NOT EXISTS credit_note_status    TEXT,
  ADD COLUMN IF NOT EXISTS credit_note_error     TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason        TEXT;

ALTER TABLE public.affiliate_payouts ALTER COLUMN referrer_id DROP NOT NULL;

ALTER TABLE public.affiliate_payouts DROP CONSTRAINT IF EXISTS affiliate_payouts_status_check;
ALTER TABLE public.affiliate_payouts ADD CONSTRAINT affiliate_payouts_status_check
  CHECK (status IN ('pending', 'processing', 'paid', 'completed', 'failed')) NOT VALID;

ALTER TABLE public.affiliate_payouts DROP CONSTRAINT IF EXISTS affiliate_payouts_tax_status_check;
ALTER TABLE public.affiliate_payouts ADD CONSTRAINT affiliate_payouts_tax_status_check
  CHECK (tax_status IS NULL OR tax_status IN ('kleinunternehmer', 'regelbesteuert')) NOT VALID;

ALTER TABLE public.affiliate_payouts DROP CONSTRAINT IF EXISTS affiliate_payouts_credit_note_status_check;
ALTER TABLE public.affiliate_payouts ADD CONSTRAINT affiliate_payouts_credit_note_status_check
  CHECK (credit_note_status IS NULL OR credit_note_status IN ('pending', 'created')) NOT VALID;

ALTER TABLE public.affiliate_payouts DROP CONSTRAINT IF EXISTS affiliate_payouts_credit_note_number_format;
ALTER TABLE public.affiliate_payouts ADD CONSTRAINT affiliate_payouts_credit_note_number_format
  CHECK (credit_note_number IS NULL OR credit_note_number ~ '^GS-[0-9]{4}-[0-9]{5,}$') NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_payouts_credit_note_number_unique
  ON public.affiliate_payouts (credit_note_number) WHERE credit_note_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payouts_status_created ON public.affiliate_payouts (status, created_at);
CREATE INDEX IF NOT EXISTS idx_payouts_credit_note_pending
  ON public.affiliate_payouts (credit_note_status) WHERE credit_note_status = 'pending';

-- ─── 3. FKs: CASCADE → SET NULL (Belege bleiben bei Kontolöschung erhalten) ──
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname, t.relname AS tbl
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.users'::regclass
      AND (
        (t.relname = 'affiliate_commissions' AND a.attname IN ('referrer_id', 'referee_id')) OR
        (t.relname = 'affiliate_payouts'     AND a.attname = 'referrer_id')
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- Zusätzlich gezielt über die Namen (falls eine FK gleichen Namens auf eine andere Tabelle
-- zeigt, z. B. aus der alten Supabase-Struktur): Drizzle-Namen aus Prod + die hier angelegten.
-- Re-Runs schlagen so nie an "constraint already exists" fehl.
ALTER TABLE public.affiliate_commissions DROP CONSTRAINT IF EXISTS affiliate_commissions_referrer_id_users_id_fk;
ALTER TABLE public.affiliate_commissions DROP CONSTRAINT IF EXISTS affiliate_commissions_referee_id_users_id_fk;
ALTER TABLE public.affiliate_payouts     DROP CONSTRAINT IF EXISTS affiliate_payouts_referrer_id_users_id_fk;
ALTER TABLE public.affiliate_commissions DROP CONSTRAINT IF EXISTS affiliate_commissions_referrer_id_fkey;
ALTER TABLE public.affiliate_commissions DROP CONSTRAINT IF EXISTS affiliate_commissions_referee_id_fkey;
ALTER TABLE public.affiliate_payouts     DROP CONSTRAINT IF EXISTS affiliate_payouts_referrer_id_fkey;

ALTER TABLE public.affiliate_commissions ADD CONSTRAINT affiliate_commissions_referrer_id_fkey
  FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.affiliate_commissions ADD CONSTRAINT affiliate_commissions_referee_id_fkey
  FOREIGN KEY (referee_id) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.affiliate_payouts ADD CONSTRAINT affiliate_payouts_referrer_id_fkey
  FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;

-- Altbestand prüfen, wenn möglich (verwaiste IDs lassen die FK einfach NOT VALID)
DO $$
BEGIN
  BEGIN ALTER TABLE public.affiliate_commissions VALIDATE CONSTRAINT affiliate_commissions_referrer_id_fkey; EXCEPTION WHEN others THEN RAISE NOTICE 'referrer_id fkey bleibt NOT VALID: %', SQLERRM; END;
  BEGIN ALTER TABLE public.affiliate_commissions VALIDATE CONSTRAINT affiliate_commissions_referee_id_fkey;  EXCEPTION WHEN others THEN RAISE NOTICE 'referee_id fkey bleibt NOT VALID: %', SQLERRM; END;
  BEGIN ALTER TABLE public.affiliate_payouts     VALIDATE CONSTRAINT affiliate_payouts_referrer_id_fkey;     EXCEPTION WHEN others THEN RAISE NOTICE 'payouts referrer_id fkey bleibt NOT VALID: %', SQLERRM; END;
END $$;

-- ─── 4. Steuerprofil des Partners ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_tax_profiles (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  tax_status             TEXT NOT NULL CHECK (tax_status IN ('kleinunternehmer', 'regelbesteuert')),
  full_name              TEXT NOT NULL,
  street                 TEXT NOT NULL,
  zip                    TEXT NOT NULL,
  city                   TEXT NOT NULL,
  country                TEXT NOT NULL DEFAULT 'DE' CHECK (country = 'DE'),
  tax_number             TEXT,
  vat_id                 TEXT,
  entrepreneur_confirmed BOOLEAN NOT NULL DEFAULT false,
  consent_at             TIMESTAMPTZ,
  consent_version        TEXT,
  consent_text           TEXT,
  consent_ip             VARCHAR(64),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_tax_profiles_tax_id_required CHECK (tax_number IS NOT NULL OR vat_id IS NOT NULL)
);
COMMENT ON TABLE public.affiliate_tax_profiles IS 'Angaben des Partners für Gutschriften; jede Auszahlung speichert einen Snapshot in affiliate_payouts.tax_profile_snapshot';

-- ─── 5. Lückenloser Nummernkreis ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_credit_note_counters (
  year        INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.affiliate_credit_note_counters IS 'GS-YYYY-NNNNN: wird in derselben Transaktion hochgezählt, in der die Auszahlung als bezahlt markiert wird (lückenlos)';

-- ─── 6. Unveränderlichkeit ausgestellter Gutschriften (GoBD) ─────────────────
-- Nach Vergabe der Nummer dürfen Belegdaten nicht mehr geändert und die Zeile nicht gelöscht
-- werden. Erlaubt bleiben: PDF-Felder (credit_note_key/status/error), updated_at, notes und
-- referrer_id → NULL (Kontolöschung).
CREATE OR REPLACE FUNCTION public.affiliate_payouts_protect_credit_note() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.credit_note_number IS NOT NULL THEN
      RAISE EXCEPTION 'Gutschrift % darf nicht gelöscht werden (§ 147 AO)', OLD.credit_note_number;
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.credit_note_number IS NOT NULL AND (
       NEW.credit_note_number   IS DISTINCT FROM OLD.credit_note_number
    OR NEW.credit_note_date     IS DISTINCT FROM OLD.credit_note_date
    OR NEW.net_amount           IS DISTINCT FROM OLD.net_amount
    OR NEW.vat_amount           IS DISTINCT FROM OLD.vat_amount
    OR NEW.gross_amount         IS DISTINCT FROM OLD.gross_amount
    OR NEW.total_amount         IS DISTINCT FROM OLD.total_amount
    OR NEW.vat_rate             IS DISTINCT FROM OLD.vat_rate
    OR NEW.tax_status           IS DISTINCT FROM OLD.tax_status
    OR NEW.tax_profile_snapshot IS DISTINCT FROM OLD.tax_profile_snapshot
    OR NEW.line_items           IS DISTINCT FROM OLD.line_items
    OR NEW.commission_ids       IS DISTINCT FROM OLD.commission_ids
    OR NEW.stripe_transfer_id   IS DISTINCT FROM OLD.stripe_transfer_id
    OR NEW.period_start         IS DISTINCT FROM OLD.period_start
    OR NEW.period_end           IS DISTINCT FROM OLD.period_end
    OR NEW.paid_at              IS DISTINCT FROM OLD.paid_at
    OR NEW.status               IS DISTINCT FROM OLD.status
    OR (NEW.referrer_id IS DISTINCT FROM OLD.referrer_id AND NEW.referrer_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Gutschrift % ist unveränderlich – Korrektur nur per neuer Buchung', OLD.credit_note_number;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_affiliate_payouts_protect_credit_note ON public.affiliate_payouts;
CREATE TRIGGER trg_affiliate_payouts_protect_credit_note
  BEFORE UPDATE OR DELETE ON public.affiliate_payouts
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_payouts_protect_credit_note();

-- ─── 7. Rechte für die App-Rolle ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finestsites') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_tax_profiles TO finestsites;
    GRANT SELECT, INSERT, UPDATE ON TABLE public.affiliate_credit_note_counters TO finestsites;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_payouts, public.affiliate_commissions TO finestsites;
  END IF;
END $$;

COMMIT;
