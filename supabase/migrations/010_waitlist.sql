-- Warteliste (pre-launch waitlist with Double Opt-In)
CREATE TABLE IF NOT EXISTS waitlist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  name            TEXT,
  source          TEXT DEFAULT 'homepage',
  confirm_token   UUID UNIQUE DEFAULT gen_random_uuid(),
  confirmed       BOOLEAN NOT NULL DEFAULT false,
  confirmed_at    TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_email_idx ON waitlist (email);
CREATE INDEX IF NOT EXISTS waitlist_confirm_token_idx ON waitlist (confirm_token);
