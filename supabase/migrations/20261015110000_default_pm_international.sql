-- Es gibt nur noch ein Unternehmen: PM-International ist für jedes Konto gesetzt (Auswahl entfernt am 15.10.2026).
ALTER TABLE public.users ALTER COLUMN nm_companies SET DEFAULT '{PM-International}';
UPDATE public.users
   SET nm_companies = array_append(coalesce(nm_companies, '{}'), 'PM-International')
 WHERE NOT ('PM-International' = ANY (coalesce(nm_companies, '{}')));
