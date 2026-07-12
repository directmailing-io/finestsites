-- Global content consent per user (replaces per-site consent).
-- Stored once at onboarding; all sites of this user are covered.
-- Legal proof fields: timestamp, IP, user-agent, text version, SHA-256 hash of exact text.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS content_consent_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_consent_ip          VARCHAR(64),
  ADD COLUMN IF NOT EXISTS content_consent_ua          TEXT,
  ADD COLUMN IF NOT EXISTS content_consent_version     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS content_consent_text_hash   VARCHAR(64);

COMMENT ON COLUMN public.users.content_consent_at        IS 'Timestamp of global content consent (legal proof)';
COMMENT ON COLUMN public.users.content_consent_ip        IS 'IP address at time of consent';
COMMENT ON COLUMN public.users.content_consent_ua        IS 'User-Agent at time of consent';
COMMENT ON COLUMN public.users.content_consent_version   IS 'Version of consent text (e.g. v1) — maps to source code constant';
COMMENT ON COLUMN public.users.content_consent_text_hash IS 'SHA-256 hex hash of exact consent text the user saw and agreed to';
