-- Empfehlungsrabatt "Modell C" – Kundenseite (16.10.2026), siehe src/lib/affiliate/referral-model.ts
--  * referral_terms: welche Bedingungen ein geworbener Kunde hat
--      'legacy10' = altes Modell, 10 % dauerhaft (Bestandsschutz)
--      'c2026'    = Modell C: Monatsabo 20 % auf die erste Rechnung, Jahresabo 10 % solange es läuft
--  * referral_discount_flag: Hinweis für den Admin (z. B. 'fingerprint_match:<username>'), kein Entzug
--  * payment_fingerprints: card/sepa_debit-Fingerprints für die Neukunden-Prüfung
--  * Backfill: alle bisher geworbenen Konten → 'legacy10' (Bestandsschutz). Bei Konten, die noch nie
--    ein Abo hatten, ist das nur ein Zuordnungs-Vermerk: er gilt nur, wenn das erste Abo bis
--    Stichtag + 30 Tage beginnt (resolveReferralTerms, termsLocked=false), danach Modell C.
--    Ausgenommen: Admin-Empfehlungen (Testpfad, Modell C sofort) bei Konten ohne Abo.
--
-- Idempotent (mehrfach ausführbar). MUSS vor dem Deploy des zugehörigen Codes laufen
-- (Drizzle liest bei findFirst ohne columns alle Spalten).

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_terms         TEXT,
  ADD COLUMN IF NOT EXISTS referral_discount_flag TEXT,
  ADD COLUMN IF NOT EXISTS payment_fingerprints   TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_referral_terms_check;
ALTER TABLE public.users ADD CONSTRAINT users_referral_terms_check
  CHECK (referral_terms IS NULL OR referral_terms IN ('legacy10', 'c2026')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_users_payment_fingerprints ON public.users USING GIN (payment_fingerprints);

-- Bestandsschutz: alle geworbenen Konten. Ohne Abo-Historie (gleiche Kriterien wie
-- hasOwnSubscriptionHistory in src/lib/affiliate/referral-offer.ts) nicht bei Admin-Empfehlung.
UPDATE public.users u
   SET referral_terms = 'legacy10'
 WHERE u.referred_by_username IS NOT NULL
   AND u.referral_terms IS NULL
   AND (
         u.stripe_subscription_id IS NOT NULL
      OR u.deactivated_at IS NOT NULL
      OR u.subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete_expired', 'unpaid')
      OR EXISTS (SELECT 1 FROM public.subscription_events e
                  WHERE e.user_id = u.id AND e.event_type = 'subscription_created')
      OR NOT EXISTS (SELECT 1 FROM public.users r
                      WHERE r.username = u.referred_by_username AND r.is_admin)
   );

COMMIT;
