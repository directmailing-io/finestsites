-- Konto löschen: Wahl „sofort“ oder „zum Laufzeitende“ (docs/app/store-start.html, Abschnitt 2; Daniel 25.10.2026).
--   now        = wie bisher: Seiten sofort offline, Abo sofort beendet (keine Erstattung), Löschung nach 14 Tagen
--   period_end = Abo zum Ende des bezahlten Zeitraums gekündigt, Seiten bis dahin online, Löschung zum
--                Laufzeitende (frühestens 14 Tage nach der Anfrage); Abbruch stellt das Abo wieder her
-- Nur ergänzend: zwei nullable/defaultete Spalten, keine Datenänderung.
BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deletion_mode text;
COMMENT ON COLUMN public.users.deletion_mode IS 'Laufende Lösch-Anfrage: now | period_end (NULL = keine Anfrage)';

ALTER TABLE public.account_deletion_requests ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'now';
COMMENT ON COLUMN public.account_deletion_requests.mode IS 'now | period_end';

COMMIT;
