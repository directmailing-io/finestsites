-- Add team_partner_number field for PM-International users
-- Used to automatically generate FitLine product URLs with sponsor parameter

ALTER TABLE users
ADD COLUMN IF NOT EXISTS team_partner_number TEXT;

COMMENT ON COLUMN users.team_partner_number IS 'Teampartner-Nummer für PM-International / FitLine. Wird automatisch in Shop-URLs als ?sponsor=NUMMER eingefügt.';
