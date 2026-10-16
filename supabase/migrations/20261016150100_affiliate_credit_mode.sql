-- Provision mit dem eigenen Abo verrechnen (16.10.2026)
--  * users.affiliate_payout_mode: 'credit' (Standard, Kundenguthaben bei Stripe) | 'payout' (Überweisung via Stripe Connect)
--    Bestandsschutz: Wer schon ein Auszahlungskonto (stripe_connect_id) hat, bekommt beim ersten Lauf 'payout'.
--    Die Rückfüllung läuft NUR, wenn die Spalte in diesem Lauf neu angelegt wird – ein zweiter Lauf
--    überschreibt also nie eine spätere Wahl des Partners.
--  * affiliate_payouts.stripe_balance_txn_id / stripe_customer_id für payout_method = 'credit'
--    (+ CHECK auf payout_method um 'credit' erweitert – vorher nur stripe_connect | manual)
--  * Unveränderlichkeit ausgestellter Gutschriften: neue Spalten + payout_method zusätzlich geschützt
--
-- Idempotent (mehrfach ausführbar).

BEGIN;

-- ─── 1. Partner-Wahl ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'affiliate_payout_mode'
  ) THEN
    ALTER TABLE public.users ADD COLUMN affiliate_payout_mode TEXT NOT NULL DEFAULT 'credit';
    UPDATE public.users SET affiliate_payout_mode = 'payout' WHERE stripe_connect_id IS NOT NULL;
  END IF;
END $$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_affiliate_payout_mode_check;
ALTER TABLE public.users ADD CONSTRAINT users_affiliate_payout_mode_check
  CHECK (affiliate_payout_mode IN ('credit', 'payout'));

-- ─── 2. Verrechnungs-Belege ──────────────────────────────────────────────────
ALTER TABLE public.affiliate_payouts
  ADD COLUMN IF NOT EXISTS stripe_balance_txn_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id    TEXT;

-- 006_affiliate_system.sql erlaubte nur 'stripe_connect' | 'manual' → 'credit' ergänzen
ALTER TABLE public.affiliate_payouts DROP CONSTRAINT IF EXISTS affiliate_payouts_payout_method_check;
ALTER TABLE public.affiliate_payouts ADD CONSTRAINT affiliate_payouts_payout_method_check
  CHECK (payout_method IS NULL OR payout_method IN ('stripe_connect', 'manual', 'credit')) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_payouts_balance_txn_unique
  ON public.affiliate_payouts (stripe_balance_txn_id) WHERE stripe_balance_txn_id IS NOT NULL;

-- ─── 3. Unveränderlichkeit (wie 20261016100000, ergänzt um die neuen Spalten) ─
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
       NEW.credit_note_number    IS DISTINCT FROM OLD.credit_note_number
    OR NEW.credit_note_date      IS DISTINCT FROM OLD.credit_note_date
    OR NEW.net_amount            IS DISTINCT FROM OLD.net_amount
    OR NEW.vat_amount            IS DISTINCT FROM OLD.vat_amount
    OR NEW.gross_amount          IS DISTINCT FROM OLD.gross_amount
    OR NEW.total_amount          IS DISTINCT FROM OLD.total_amount
    OR NEW.vat_rate              IS DISTINCT FROM OLD.vat_rate
    OR NEW.tax_status            IS DISTINCT FROM OLD.tax_status
    OR NEW.tax_profile_snapshot  IS DISTINCT FROM OLD.tax_profile_snapshot
    OR NEW.line_items            IS DISTINCT FROM OLD.line_items
    OR NEW.commission_ids        IS DISTINCT FROM OLD.commission_ids
    OR NEW.stripe_transfer_id    IS DISTINCT FROM OLD.stripe_transfer_id
    OR NEW.stripe_balance_txn_id IS DISTINCT FROM OLD.stripe_balance_txn_id
    OR NEW.stripe_customer_id    IS DISTINCT FROM OLD.stripe_customer_id
    OR NEW.payout_method         IS DISTINCT FROM OLD.payout_method
    OR NEW.period_start          IS DISTINCT FROM OLD.period_start
    OR NEW.period_end            IS DISTINCT FROM OLD.period_end
    OR NEW.paid_at               IS DISTINCT FROM OLD.paid_at
    OR NEW.status                IS DISTINCT FROM OLD.status
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

COMMIT;
