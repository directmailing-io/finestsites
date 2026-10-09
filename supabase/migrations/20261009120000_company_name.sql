-- Firma (freiwillig) im Profil; wird vom Worker in Impressum/Datenschutz eingesetzt ({{firma}})
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name TEXT;
